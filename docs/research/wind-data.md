# Wind data research: NOAA/NWS sources

Researched 2026-11-01 by a Claude Code sub-agent. **[V]** = checked against live API responses on that date for both test locations. **[D]** = from documentation or memory, not verified.

Test locations: zip 02882 (Narragansett, RI, about 41.44, -71.46) and zip 92651 (Laguna Beach, CA, about 33.54, -117.78).

> **Update since this research:** the "tides use `lst_ldt` naive strings" points below are out of date. `feature/station-timezones` changed tides to ISO 8601 UTC (`...Z`) and added `Station.timeZone`. That settles the time-convention question in favor of UTC everywhere.

## 1. Summary and recommendation

- **Hourly forecast:** use the raw gridpoint data, `GET /gridpoints/{wfo}/{x},{y}`. It's the only NWS endpoint with all three of speed, **gust** and **direction in degrees**, resolvable to hourly values for about 7.5 days [V].
  - `/forecast/hourly` is simpler, but it has **no gust** (`windGust` is null even with the feature flag). Direction is only a 16-point compass string ("SW"), and speed is a string ("8 mph") [V].
  - For Laguna Beach, `/forecast/hourly` also showed values that didn't track the grid: a constant 15 mph while the grid varied from 11 to 15 kt [V].
- **Current wind:** use CO-OPS `product=wind` from a nearby station that has a wind sensor, with NWS `/stations/{id}/observations/latest` as a fallback.
  - CO-OPS fits the existing code (same datagetter, same `{error}` handling).
  - It reports every 6 minutes, and its stations are on the water (Newport RI, La Jolla, Long Beach Pier J).
  - NWS observation stations are mostly inland airports or citizen (CWOP) stations, and were often stale or null [V].
  - **Neither of our current nearest tide stations (Point Judith, Newport Bay Entrance) has wind**, so wind needs its own station lookup.
- **Marine forecasts:** skip them for v1. They're text-only (see section 6).
- **Offshore vs onshore:** needs a configured shore-facing bearing per spot. No NOAA API provides one.

## 2. Endpoints

| Purpose | URL pattern | Format | Update cadence and caching | Auth and headers |
|---|---|---|---|---|
| Point → grid metadata | `https://api.weather.gov/points/{lat},{lng}` (max 4 decimals) | GeoJSON | `cache-control: max-age=86400` [V]. Effectively static, so cache per zip indefinitely. | `User-Agent: (app, contact-email)` required [D]. `Accept: application/geo+json` optional. |
| Raw grid (speed, gust, direction) | `https://api.weather.gov/gridpoints/{gridId}/{gridX},{gridY}` | JSON-LD/GeoJSON, ISO 8601 interval layers | `max-age=3600` [V]. `updateTime` was about 19:00Z, updated several times a day. | same |
| Hourly forecast (simple) | `.../gridpoints/{gridId}/{x},{y}/forecast/hourly` (`?units=si` for km/h) | GeoJSON `periods[]` | `max-age=3600`, with `last-modified` and `etag` [V]. 156 hourly periods, about 6.5 days [V]. | Optional `Feature-Flags: forecast_wind_speed_qv` makes speed numeric [V] |
| 12-hour text forecast | `.../forecast` | `periods[]` | same | Gust only appears in the prose ("gusts as high as 23 mph") unless the flag above adds `windGust` [V] |
| Nearby observation stations | `.../gridpoints/{gridId}/{x},{y}/stations?limit=N` (sorted by distance) | FeatureCollection | `max-age=86400` [V] | same |
| Latest observation | `https://api.weather.gov/stations/{id}/observations/latest` | Feature | `s-maxage=300` [V] | same |
| Observation history | `.../stations/{id}/observations?limit=N` | FeatureCollection | same | same |
| CO-OPS wind | `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=wind&station={id}&date=latest&units=english&time_zone=gmt&format=json&application=surf-report` | JSON | 6-minute data; `interval=h` gives hourly [V] | none (`application=` is a courtesy) |
| CO-OPS stations with wind | `https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=met` (314 stations) [V], then `/stations/{id}/sensors.json` to confirm a "Wind" sensor | JSON | static | none |
| NDBC buoy / C-MAN | `https://www.ndbc.noaa.gov/data/realtime2/{ID}.txt` | Whitespace-separated text | about 10–60 min | none |
| Marine zone forecast | `https://api.weather.gov/zones/forecast/{ANZ236}/forecast`, or `tgftp.nws.noaa.gov/data/forecasts/marine/coastal/an/anz236.txt` | Text periods | several times a day | — |

- **Rate limits [D]:** not published ("generous"). Going over returns 403 or 429, and the docs suggest retrying after about 5 seconds. About 40 requests hit no limit.
- **User-Agent [D]:** NWS requires an identifying `User-Agent`. Not tested without one, because curl always sends its own. Node's `fetch` sends `node` by default, so set the header explicitly.
- **Reliability [D]:** api.weather.gov has well-known intermittent 500/503 errors and stale `/forecast` responses. Handle failures the way the tide service does: log, then return `[]` or `null`.

## 3. Field mapping

| Concept | NWS grid | NWS `/forecast/hourly` | NWS observation | CO-OPS `wind` | NDBC realtime2 |
|---|---|---|---|---|---|
| time | `validTime`: `"2026-11-01T12:00:00+00:00/PT3H"` (UTC start / ISO duration) | `startTime` / `endTime` with local offset, e.g. `-05:00` | `timestamp` (UTC ISO) | `t`: `"2026-11-01 22:00"`, no offset (gmt or lst_ldt, depending on the request) | `#YY MM DD hh mm`, UTC |
| speed | `windSpeed.values[].value`, `wmoUnit:km_h-1` | `windSpeed`: `"8 mph"` (string; `"13 km/h"` with `units=si`) | `windSpeed.value`, km/h | `s`, **knots** with `units=english` (m/s with `metric`) [V] | `WSPD`, m/s |
| gust | `windGust`, km/h | **none** | `windGust.value`, km/h, often null | `g`, knots | `GST`, m/s |
| direction | `windDirection`, degrees "from", true north | `windDirection`: `"SW"` (16-point) | `windDirection.value`, degrees | `d` (degrees as a string, `"234.0"`) and `dr` (`"SW"`) | `WDIR`, degrees true |
| quality | — | — | `qualityControl` (`V` = verified, `Z` = missing or no QC, `C`/`S` = other flags) | `f`: `"0,0"` flags | `MM` = missing |

Grid speeds are knots stored as km/h: values such as 5.556, 11.112 and 22.224 are exactly 3, 6 and 12 kt × 1.852 [V]. Dividing km/h by 1.852 gives clean whole knots.

## 4. Real samples (trimmed)

**`/points`, RI, 41.44,-71.46 [V]**
```json
{"gridId":"BOX","gridX":65,"gridY":57,
 "forecastHourly":"https://api.weather.gov/gridpoints/BOX/65,57/forecast/hourly",
 "forecastGridData":"https://api.weather.gov/gridpoints/BOX/65,57",
 "observationStations":"https://api.weather.gov/gridpoints/BOX/65,57/stations",
 "forecastZone":"https://api.weather.gov/zones/forecast/RIZ006","timeZone":"America/New_York",
 "relativeLocation":{"city":"Narragansett Pier","state":"RI"}}
```

**`/points`, CA, 33.54,-117.78 [V]:** `SGX/40,54`, zone `CAZ552`, `America/Los_Angeles`, city Laguna Beach.

**Grid, RI (`BOX/65,57`) [V].** `updateTime` 2026-11-01T18:59:06Z, `validTimes` `2026-11-01T12:00:00+00:00/P7DT13H`.
```json
"windSpeed":{"uom":"wmoUnit:km_h-1","values":[
  {"validTime":"2026-11-01T12:00:00+00:00/PT1H","value":5.556},
  {"validTime":"2026-11-01T15:00:00+00:00/PT2H","value":11.112}, ...]},
"windGust":{"uom":"wmoUnit:km_h-1","values":[{"validTime":"2026-11-01T12:00:00+00:00/PT2H","value":11.112}, ...]},
"windDirection":{"uom":"wmoUnit:degree_(angle)","values":[{"validTime":"2026-11-01T12:00:00+00:00/PT1H","value":320}, ...]}
```
The last entry is `2026-11-09T00:00:00+00:00/PT1H`. In the CA grid, the later entries become 6-hour (`PT6H`) blocks.

**Grid, CA (`SGX/40,54`) [V]**
```json
"windSpeed":[{"validTime":"2026-11-01T13:00:00+00:00/PT1H","value":11.112}, ...],
"windGust":[{"validTime":"2026-11-01T13:00:00+00:00/PT1H","value":22.224},{"validTime":"2026-11-01T14:00:00+00:00/PT2H","value":16.668}, ...],
"windDirection":[{"validTime":"2026-11-01T13:00:00+00:00/PT1H","value":280}, ...]
```

**`/forecast/hourly`, first period [V]**
```json
{"startTime":"2026-11-01T17:00:00-05:00","endTime":"2026-11-01T18:00:00-05:00",
 "windSpeed":"8 mph","windDirection":"SW","shortForecast":"Sunny"}
```
CA: `{"startTime":"2026-11-01T14:00:00-08:00","windSpeed":"15 mph","windDirection":"W"}`

**Expanded grid compared with `/forecast/hourly` for the same hours [V]**
```
RI 17:00-05:00  hourly 8 mph SW | grid 7 kt (8.1 mph), gust 12.7 mph, 240°
CA 14:00-08:00  hourly 15 mph W | grid 15 kt (17.3 mph), gust 26.5 mph, 270°
CA 15:00-08:00  hourly 15 mph W | grid 11 kt (12.7 mph), gust 21.9 mph, 270°   <- hourly doesn't track the grid
```

**NWS latest observations, at about 22:04Z [V]**
```
KOQU (Quonset, 18 km): ts 17:50Z (4 h stale!) dir 300 speed 16.56 km/h gust null(Z)  raw "30009KT"
KBID (Block Island, 31 km): ts 21:45Z dir 260 speed 16.668 gust null
KSNA (John Wayne, 17 km): ts 21:45Z dir 250 speed 18.504 gust 31.5 (QC "C")
E3225 (CWOP Laguna Hills, 8.6 km): speed 0 but gust 16.1 -> suspect
F1327 (San Clemente Pier, 20.7 km): dir null, speed null (Z), gust 46.7
```
Nearest stations for RI: KOQU, KWST, KBID, KPVD. For CA: E3225 (CWOP), KSNA, C5283, CAPC1, F1327. These are mostly MADIS/CWOP stations of variable quality.

**CO-OPS wind, `units=english` [V]**
```json
{"metadata":{"id":"8452660","name":"Newport","lat":"41.5043","lon":"-71.3261"},
 "data":[{"t":"2026-11-01 22:00","s":"8.36","d":"234.0","dr":"SW","g":"11.08","f":"0,0"}]}
```

| CO-OPS station | Distance | Wind? |
|---|---|---|
| 8455083 Point Judith | — | **No** (`{"error":{"message":"No data was found..."}}`) |
| 8452660 Newport | 13 km from the RI test point | Yes |
| 8454123 Port of Davisville | 19.5 km | Yes |
| 8452944 Conimicut Light | 32 km | Yes |
| 8454049 Quonset Point | — | No |
| 9410580 Newport Bay Entrance | — | **No** |
| 9410660 Los Angeles | — | **No** |
| 9410170 San Diego | — | No |
| 9410230 La Jolla | about 85 km | Yes (18.08 kt WNW) |
| 9410665 Long Beach Pier J | 43 km | Yes (19.44 kt W) |
| 9410647 Angels Gate | 47 km | Yes |
| 9410666 LA Pier 400 | 48 km | Yes |
| 9410840 Santa Monica | — | Yes |

`stations.json?type=met` includes visibility-only stations (for example 8452314 Sandy Point returned no wind), so filter by the "Wind" sensor in `sensors.json` [V].

**NDBC (brief) [V]:** `WDIR` in degrees true, `WSPD` and `GST` in m/s, `MM` for missing values. BUZM3 (Buzzards Bay), 46086 (San Clemente Basin) and LJAC1 (La Jolla) have wind. The wave buoys near both spots (44097 Block Island, 44085, 46253 San Pedro South) are wave-only, with wind reported as `MM`, so they're no use for wind.

## 5. Expanding ISO 8601 interval durations [V: algorithm tested on both grids]

`validTime` is `"<UTC start>/<duration>"`, where the duration is `PT{n}H`, `P{d}D` or `P{d}DT{n}H`. Each entry means "this value holds for every hour from the start until start + duration". To expand it:

1. Parse the start with `Date.parse`.
2. Parse the duration with `/^P(?:(\d+)D)?(?:T(?:(\d+)H)?)?$/`, giving hours = d × 24 + h.
3. Emit one value per hour (`start + i × 3600e3`), keyed by the UTC ISO string.

Both grids expanded to about 181–185 consecutive hours, and the speed, gust and direction layers produced identical keys. After expanding:

- Drop hours before "now".
- Join the layers by key.
- Clip to the tide week.
- **Always join after expanding, never by array index.** The layers can have different interval boundaries (for example speed `PT2H` where gust is `PT1H`).
- Minutes are always `:00` in practice. Treat any gaps as null; none were seen.

## 6. Coastal and offshore behavior of `/points` [V]

- **Both test zips:** the zip centroid resolved to a **land** grid cell, distance 0 from the town.
- **Slightly offshore** (41.40,-71.46, 341 m off the coast): resolved to BOX/66,55 in marine zone `ANZ236`. `/forecast/hourly` still worked (156 periods, 10 mph W).
- **Further offshore** (41.30,-71.46 → BOX/66,51; 33.50,-117.80 → **LOX**/167,18, a *different forecast office* from SGX): `/forecast/hourly` returns **404 "Marine Forecast Not Supported"**. The raw `/gridpoints/...` still **works**, and includes `waveHeight` and similar fields.
- **Far offshore** (40.0,-70.0, 138 km out): `gridId: null`, with only a marine zone.
- **More than 4 decimals:** returns **301 "Adjusting Precision Of Point Coordinate"**. Node's `fetch` follows the redirect, but rounding to 4 decimals avoids the extra request.

**Conclusion:** use the zip centroid (on land) or the beach's coordinates. A land grid cell next to the water is fine for wind.

**Marine forecasts [V]:** `/zones/forecast/ANZ236/forecast` periods are prose only, for example `"W winds 5 to 10 kt with gusts up to 20 kt. Waves around 2 ft."` They come in 12-hour or multi-day blocks and would need regex parsing. Not worth it for v1; at most, show the text as-is.

## 7. Direction, and offshore versus onshore

- **Convention:** every source uses the meteorological "from" direction, in degrees clockwise from true north [V/D]. `/forecast/hourly` and CO-OPS `dr` use 16-point compass strings; convert with index × 22.5°.
- **Calm:** reported as speed 0 and direction 0 (KOQU "00000KT" → 0/0) [V]. Ignore direction when speed is 0.
- **Offshore/onshore calculation:**
  1. Configure a `shoreNormalDeg` per spot: the compass direction the beach faces, out to sea.
  2. Compute `delta = angleDiff(windFromDeg, shoreNormalDeg)`.
  3. Wind blowing *from* the sea (|delta| < about 45°) is **onshore**. |delta| > about 135° is **offshore**. Anything in between is **cross-shore** (cross-onshore or cross-offshore).
- **No NOAA API returns a shoreline normal.** NOAA's shoreline datasets (CUSP, Medium Resolution Shoreline) are GIS shapefiles. Deriving normals from them is a large GIS job, and zip centroids aren't beaches anyway.
- **Recommendation:** a small hand-configured table of spots: zip or spot → lat/lng, `shoreNormalDeg`, and an optional wind station id.
- **Rough values (unverified):** Laguna Beach faces about 225–235° (SW). Narragansett Town Beach faces roughly SE to S. Check both on a map.

## 8. Pitfalls

1. **Stale "latest" observations.** KOQU's latest was 4 hours old. Always check how old `timestamp` is (for example, reject anything over 90 minutes) and fall back to the next station.
2. **Nulls.** Check for `value: null` with `qualityControl: "Z"` on every field.
   - A null gust usually just means no gusts, not an error.
   - Speed can be null while gust has a value (F1327).
   - CWOP stations can show speed 0 with a gust of 16 (E3225).
3. **Units.** Normalize internally (store knots) and convert for display. Surfers usually expect knots or mph.
   - **NWS JSON:** km/h (grid, observations, and `/forecast/hourly` with `units=si`).
   - **`/forecast/hourly` default:** a string like `"N mph"`. `/forecast` also uses ranges like `"7 to 12 mph"` [V].
   - **CO-OPS with `english`:** knots, as strings.
   - **NDBC:** m/s.
   - **Conversions:** kt = km/h ÷ 1.852; mph = km/h ÷ 1.609344; kt = m/s × 1.943844.
4. **Time zones.**
   - The grid and observations are UTC. `/forecast/hourly` uses a local offset.
   - CO-OPS `t` has **no offset**: request `time_zone=gmt` and append `Z`.
   - Use ISO UTC everywhere so wind and tide hours line up. (Tides already do this; see the update note at the top.)
5. **CO-OPS returns HTTP 200 with an `{error}` body** for stations without wind, the same as for tides. Values are strings.
6. **The grid starts in the past.** Its `validTimes` begin at forecast issuance (12Z), hours before now, so filter them. It also runs past `/forecast/hourly`, to about day 8, with coarse 6-hour blocks at the end.
7. **`/forecast/hourly` doesn't always match the grid.** In CA it showed a constant 15 mph while the grid varied from 11 to 15 kt for the same `updateTime` [V]. Cause unknown, possibly smoothing or caching. Another reason to use the grid.
8. **Nearby coordinates can map to different offices and grids** (SGX vs LOX). Cache the `/points` result per zip; don't hard-code it.
9. **The grid response is large**, about 100–300 KB, because it includes every weather element. Fetch each gridpoint at most once an hour and cache it in memory by `gridId/x,y`, respecting `max-age=3600`.

## 9. Suggested first implementation (fits the current architecture)

1. **`service/nws-points.service.ts`, `getGridPoint(lat, lng)`.** Fetch `/points/{lat.toFixed(4)},{lng.toFixed(4)}` with a `User-Agent` header, and map it to our own `GridPoint { office, gridX, gridY, timeZone }`. Cache in a module-level `Map` per zip, effectively forever.
2. **`service/nws-wind.service.ts`, `getWindForecast(gridPoint)`.**
   - Fetch `/gridpoints/{office}/{x},{y}`.
   - Expand the `windSpeed`, `windGust` and `windDirection` intervals into hourly maps, then join them by UTC hour.
   - Clip to the same 168 hours as the tides.
   - Map to `WindForecast[]`: `{ time, speedKts, gustKts, directionDeg }`, with nullable numbers, in `model/wind-forecast.ts`.
   - Cache per gridpoint with a one-hour TTL.
   - Return `[]` on failure (logged), matching `noaa-tides.service`.
3. **Wire it in.** In `getConditions`, add `windForecast` to `ConditionsResponse` alongside `tideLevels`. Fetch tides and wind together with `Promise.all`.
4. **Next: current wind.**
   - `getCurrentWind(lat, lng)` using CO-OPS `product=wind&date=latest&units=english&time_zone=gmt`.
   - Choose the nearest station from a list loaded at startup: `type=met`, filtered to stations with a Wind sensor. Or start with a hard-coded allowlist.
   - Check for staleness, and fall back to NWS `/observations/latest` from the `/gridpoints/.../stations` list.
5. **Later: offshore/onshore labels.** Add the per-spot `shoreNormalDeg` config and an `offshore | cross | onshore` label.

## 10. Open questions

- ~~**Time convention.** Move tides to ISO UTC so wind and tide hours line up?~~ Resolved: `feature/station-timezones` uses ISO UTC.
- **Display units:** knots (the surf convention) or mph?
- **Maximum distance for the current-wind station.** La Jolla is about 85 km from Laguna Beach. Is that acceptable, or should the app say "no nearby station"?
- **Spots.** The offshore/onshore label needs per-location config. Introduce a "spots" concept, or stay zip-only?
- **Not verified:**
  - Exact NWS rate limits.
  - What happens without a `User-Agent`.
  - The cause of the CA hourly/grid mismatch.
  - How often the grid updates (only one `updateTime` was seen per location).
  - The shore-facing bearings in section 7.
