# Swell data research: NDBC buoys, CDIP and forecast sources

Researched 2026-11-01 (about 22:00 UTC) by a Claude Code sub-agent. Everything was fetched live unless marked *[doc]* (documentation or memory, not tested) or *[unverified]*.

Test locations: zip 02882 (Narragansett, RI, 41.44, −71.46) and zip 92651 (Laguna Beach, CA, 33.54, −117.78).

## 1. Summary and recommendation

- **Observations: use the NDBC `realtime2/{ID}.spec` files.**
  - They're the only NDBC product that splits **swell** (SwH/SwP/SwD) from **wind waves** (WWH/WWP/WWD).
  - Plain text: whitespace-separated, two `#` header rows, newest row first, 45 days of history. No API key, no JSON.
  - This one source covers both test locations, because the Scripps CDIP buoys are relayed into NDBC under 5-digit WMO ids (for example, CDIP 284 is NDBC 46285).
- **Station discovery:** use `activestations.xml` for coordinates, and match it against the list of `.spec` files in the `realtime2/` directory. The XML has no "reports waves" flag, so the directory listing is how you know which stations have waves. Both fit the existing pattern of loading once at startup and searching with haversine.
- **Forecasts: start with the NWS gridpoint API (api.weather.gov).** It returns JSON with `waveHeight`, `wavePeriod`, `primarySwellHeight/Direction`, `secondarySwellHeight/Direction`, `wavePeriod2` and `windWaveHeight`, up to about 7 days ahead. It's low effort, with real caveats:
  - Values only exist for **marine grid cells**. Land or bay cells return the value `0`, not null.
  - Values are rounded to whole feet (multiples of 0.3048 m).
  - The Boston (BOX) office has no swell fields.
- **Better forecasts later:**
  - **WAVEWATCH III global model via ERDDAP:** JSON over HTTP with swell and wind-wave partitions, but on a coarse 0.5° grid, and the cells next to the coast are masked (null).
  - **CDIP MOP nearshore forecasts:** California only, points about 100 m apart along the shore, every 3 hours, about 6 days ahead. Accessed via OPeNDAP ASCII.
- **For human-readable context:** the NWS Surf Zone Forecast (SRF) text product gives surf height in feet and a swell remark, but as free text.

## 2. Endpoints

| Purpose | URL | Format | Update cadence and notes |
|---|---|---|---|
| Station list | `https://www.ndbc.noaa.gov/activestations.xml` | XML, 272 KB, 1,352 stations | Regenerated about hourly (`created="2026-11-01T22:00:03UTC"`). `cache-control: max-age=60` |
| Which stations have wave files | `https://www.ndbc.noaa.gov/data/realtime2/` | HTML directory listing, 552 KB | 245 `.spec` files, 944 `.txt` files |
| Latest observation, all stations | `https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt` | Text, 103 KB, about 866 rows | Only the newest row per station (see pitfalls) |
| Standard weather + summary waves | `https://www.ndbc.noaa.gov/data/realtime2/{ID}.txt` | Text, 200–620 KB | 45 days (verified: newest 2026-11-01, oldest 2026-09-17). `max-age=600`. Last-Modified was about 20 min after the newest observation |
| Swell / wind-wave split | `https://www.ndbc.noaa.gov/data/realtime2/{ID}.spec` | Text, about 150 KB | 45 days. Hourly for NDBC's own buoys, every 30 min for CDIP buoys |
| Per-frequency spectra (advanced) | `realtime2/{ID}.data_spec`, `.swdir`, `.swdir2`, `.swr1`, `.swr2` | Text, `value (freq)` pairs | Hourly. Only needed to compute our own partitions or swell direction in degrees |
| CDIP direct | `https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/realtime/{cdipId}p1_rt.nc.ascii?waveTime[a:1:b],waveHs[...],waveTp[...],waveDp[...]` | OPeNDAP ASCII (`.dds`/`.das` for metadata) | Every 30 min. Time is epoch seconds at the **start** of the sample window. Includes `metaWaterDepth` (buoy 284: 11.1 m) |
| NWS point → grid | `https://api.weather.gov/points/{lat},{lon}`, then `properties.forecastGridData` → `/gridpoints/{WFO}/{x},{y}` | JSON (GeoJSON) | Forecast updates several times a day. `validTime` is an ISO interval such as `2026-11-01T18:00:00+00:00/PT6H` |
| NWS Surf Zone Forecast | `https://api.weather.gov/products/types/SRF/locations/{SGX|BOX}`, then `/products/{id}` → `productText` | JSON wrapping free text | Issued 1–2 times a day. Verified for SGX and BOX |
| WW3 global forecast | `https://coastwatch.pfeg.noaa.gov/erddap/griddap/NWW3_Global_Best.json?Thgt[(time)][(0.0)][(lat)][(lon0to360)],shgt[...],sper[...],sdir[...],whgt[...],wper[...],wdir[...]` | JSON table | Redirects (302) to PacIOOS ERDDAP (`pae-paha.pacioos.hawaii.edu`); Node's `fetch` follows redirects by default. Hourly steps out to about +6 days. 0.5° grid, longitude 0–359.5. Responses took about 1.7 s |
| CDIP MOP nearshore forecast (CA only) | `https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore/{MOPID}_forecast.nc.ascii?waveTime,waveHs,waveTp,waveDp,...` | OPeNDAP ASCII | 80 steps, every 3 hours, from about 3 days ago to about 6 days ahead. Example: OC050 at 33.418, −117.631, 10 m depth |

**Access requirements:**
- **CORS:** NDBC sends no CORS headers (checked with an `Origin` header), so it must be called from the server. That fits our architecture.
- **Keys and rate limits:** NDBC needs no API key, and no rate-limit headers were seen.
- **User-Agent:** api.weather.gov requires an identifying `User-Agent` *[doc]*. `surf-report-dev-research` worked.
- **NDBC SOS service** (`sdf.ndbc.noaa.gov`): didn't resolve in DNS from this machine. *[unverified]*, not recommended.
- **No JSON API** for NDBC.

## 3. Field mapping

| Our concept | Source / column | Units and notes |
|---|---|---|
| Observation time | `#YY MM DD hh mm` (first 5 columns) | **UTC** |
| Significant wave height (total) | `.spec` WVHT (also `.txt` WVHT) | metres |
| Swell height | `.spec` **SwH** | metres |
| Swell period | `.spec` **SwP** | seconds, one decimal place |
| Swell direction | `.spec` **SwD** | **16-point compass text** (`SSW`, `SE`), not degrees. Convert with index × 22.5°. For degrees, use CDIP `waveDp` (peak direction, mostly the swell when periods are long) or compute it from `.swdir` |
| Wind-wave height / period | `.spec` **WWH / WWP** | metres / seconds |
| Wind-wave direction | `.spec` **WWD** | Compass text, even though the header says `degT` |
| Dominant (peak) period | `.txt` DPD | seconds, whole numbers |
| Average period | `.txt` or `.spec` APD | seconds |
| Mean wave direction | `.txt` or `.spec` MWD | Degrees true, the direction waves come **from** |
| Sea state label | `.spec` STEEPNESS | `SWELL`, `AVERAGE`, `STEEP`, `VERY_STEEP`, or `N/A` (common at northeast buoys) |
| Water temperature | `.txt` WTMP | °C |
| Forecast height / swell | NWS `waveHeight`, `primarySwellHeight`, `primarySwellDirection`, `wavePeriod`, `wavePeriod2`, `windWaveHeight` | Metres (in whole-foot steps); direction in degrees. There's no `primarySwellPeriod`; `wavePeriod2` seems to be the swell period *[inferred, unverified]* |
| Forecast (WW3) | `Thgt`/`Tper`/`Tdir` (total), `shgt`/`sper`/`sdir` (swell), `whgt`/`wper`/`wdir` (wind waves) | metres, seconds, degrees |

**Missing values:**
- `MM` is the usual missing marker.
- `-99` also appears in MWD (seen in the 44020 and 44085 `.spec` files).
- `N/A` appears in STEEPNESS.
- In `.spec`, the entire swell split is sometimes `MM` while WVHT has a value, for example: `2026 11 01 19 10  0.2 MM MM MM MM MM MM N/A 2.4 -99`.

## 4. Real samples (trimmed)

**46285 Capistrano Beach Nearshore (CDIP 284), about 8.7 mi from Laguna Beach**

`.txt`:
```
#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE
#yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT   hPa  degC  degC  degC  nmi  hPa    ft
2026 11 01 21 26  MM   MM   MM   1.4    17   7.8 211     MM    MM  23.1    MM   MM   MM    MM
```

`.spec`:
```
#YY  MM DD hh mm WVHT  SwH  SwP  WWH  WWP SwD WWD  STEEPNESS  APD MWD
#yr  mo dy hr mn    m    m  sec    m  sec  -  degT     -      sec degT
2026 11 01 21 26  1.4  1.1 16.7  0.8  3.6 SSW   W      SWELL  7.8 211
2026 11 01 20 56  1.3  1.1 16.7  0.6  4.2 SSW   W      SWELL  8.6 211
```

CDIP direct for the same buoy: the 21:00Z record has Hs 1.38, Tp 16.67, Dp 210.9. That matches NDBC's 21:26 row, so NDBC labels each reading with the time the sample ended. CDIP already had a 21:30Z record (Hs 1.42) that NDBC didn't show yet.

**44097 Block Island, RI (CDIP 154), about 37 mi from Narragansett**

`.txt`:
```
2026 11 01 21 30  MM   MM   MM   0.6    10   3.3 132     MM  12.0  14.9    MM   MM   MM    MM
```

`.spec`:
```
2026 11 01 21 30  0.6  0.2 10.0  0.5  9.5  SE  SE        N/A  3.3 132
```

**46086, an NDBC-owned buoy.** Weather rows every 10 minutes, with wave rows mixed in; the other rows show `MM` for waves:
```
2026 11 01 21 30 280 10.0 12.0    MM    MM    MM  MM 1011.9 ...
2026 11 01 21 20 280 10.0 12.0   2.1    16   5.9 182 1011.8 ...
```

## 5. Coverage near the test locations

Distances are haversine from the zip centroid, using `activestations.xml`. "spec ✓" means a `.spec` file exists.

**02882 Narragansett (41.44, −71.46)**

| ID | Name | Distance | Waves? |
|---|---|---|---|
| 44085 | Buzzards Bay MA (CDIP 260, NERACOOS) | 22.5 mi | spec ✓, 0.6 m. Inside Buzzards Bay, so it doesn't see the swell that reaches RI |
| **44097** | **Block Island RI (CDIP 154, Scripps)** | **37.1 mi** | **spec ✓, all fields populated.** The best match for south-facing RI breaks |
| 44017 | Montauk Point (NDBC) | 60.0 mi | Listed as active, but `realtime2/44017.txt` returns **404**, so it's effectively offline |
| 44020 | Nantucket Sound (NDBC) | 61.1 mi | spec ✓, sheltered sound |

The closer stations (NWPR1, BUZM3, …) are CO-OPS or C-MAN fixed stations with no wave data. **With a 50-mile limit only 44085 and 44097 qualify, and "nearest" would pick 44085, the wrong one.**

**92651 Laguna Beach (33.54, −117.78)**

| ID | Name | Distance | Latest reading |
|---|---|---|---|
| **46285** | **Capistrano Beach Nearshore (CDIP 284)** | **8.7 mi** | 1.4 m, 17 s, 211°, swell SSW, depth 11 m |
| 46277 | Green Beach Offshore (CDIP 271) | 15.7 mi | 1.5 m, 15 s, 187° |
| 46253 | San Pedro South (CDIP 213) | 23.3 mi | 1.7 m, 6 s, 282° |
| 46275 | Red Beach Nearshore (CDIP 264) | 23.6 mi | 1.2 m, 15 s, 217° |
| 46256 | Long Beach Channel | 26.6 mi | |
| 46224 | Oceanside Offshore | 30.7 mi | |
| 46222 | San Pedro | 31.2 mi | |
| 46086 | San Clemente Basin (NDBC) | 73.0 mi | Outside 50 mi |

Southern California has many buoys, all of them CDIP.

**How NDBC and CDIP relate:**
- CDIP (Scripps) runs the Datawell directional buoys, and NDBC relays their data under WMO ids. The station name includes the CDIP number in parentheses, for example `(284)`, which gives an easy mapping.
- Their `.txt` files contain only wave data and water temperature: no wind or pressure.
- CDIP's own data (THREDDS) is the same measurement, plus:
  - fresher records (about 30 minutes sooner),
  - peak direction in numeric degrees,
  - water depth,
  - quality-control flags,
  - full spectra.
- CDIP's nearshore MOP forecasts are the best freely available nearshore swell forecasts for California. They don't cover RI.

## 6. Forecast options

| Source | Effort | Quality and caveats |
|---|---|---|
| **NWS gridpoints** (api.weather.gov) | **Low**: two JSON requests, reusing `fetch` plus a `User-Agent` | **Must hit a marine grid cell**; land and bay cells return `value: 0` for the whole period. 41.44,−71.46 and 41.40,−71.47 gave zeros; 41.35,−71.45 (BOX/66,53) gave real data. Laguna Beach's 33.54,−117.78 is an SGX land cell (zeros); 33.53,−117.80 maps to LOX 167,19 with real data. Values are rounded to the foot. BOX has no primary/secondary swell fields, and `waveDirection` was empty everywhere. Needs logic to move the point offshore, and the ISO 8601 intervals need expanding |
| **WW3 via ERDDAP** (PacIOOS) | **Low–medium**: one JSON request; build the query brackets; longitude 0–360; pick the nearest non-null cell | Has swell and wind-wave partitions. 0.5° is too coarse for the Southern California Bight: the coastal cells were null, and the nearest valid cell gave a nonsense result (shgt 0.08 m, sper 25 s). Acceptable for an offshore reading like RI's |
| **CDIP MOP** (CA only) | **Medium**: parse OPeNDAP ASCII; needs an index of MOP points with lat/lng (the THREDDS catalog listing has about 10,800 entries) | The best nearshore answer for California, at 10 m depth |
| **NOMADS GFS-Wave / NWPS GRIB2** | **High**: needs GRIB decoding in Node | Not recommended for this project *[not tested]* |
| **NWS SRF text** | Low to fetch; fragile to parse | Gives text like "Surf Height 3 to 6 feet" and "South swell from 190 degrees". Good for showing as-is |

## 7. Pitfalls

1. **The nearest buoy isn't always the best one.** Sheltered buoys (Buzzards Bay, Nantucket Sound) and open-ocean buoys may not reflect conditions at the beach. Consider a hand-maintained override map per region, or prefer buoys with "Nearshore"/"Offshore" in their CDIP name. A plain 50-mile nearest search gets RI wrong unless 44097 is chosen deliberately.
2. **"Active" doesn't mean "reporting".** 44017 is in `activestations.xml` but its file returns 404, and 46273 has no file at all. Handle 404s by falling back to the next-nearest buoy.
3. **Stale data.** Parse the newest row's UTC time and treat anything older than about 2–3 hours as stale. The file's Last-Modified header isn't a reliable signal.
4. **Mixed rows.** NDBC's own buoys interleave 10-minute weather rows that show `MM` for waves, so use the newest row where WVHT isn't `MM`. For the same reason, `latest_obs.txt` shows `MM` waves for 44020 and 46086 even though they measure waves. **Don't use `latest_obs.txt` to find wave stations:** only 171 stations showed waves there, against 245 `.spec` files.
5. **Missing markers:** `MM`, `-99` and `N/A`. The whole swell split can be `MM` while WVHT has a value.
6. **Units and conventions.**
   - Metres, seconds, UTC.
   - Directions are degrees true, the direction waves come **from**.
   - SwD and WWD are compass strings despite the `degT` header.
   - Convert to feet in our mapping code (1 m = 3.28084 ft). NWS values are foot-rounded metres.
7. **ID casing.** C-MAN station ids are lowercase in the XML (for example `buzm3`), but realtime2 filenames are uppercase (`BUZM3.txt` → 200, `buzm3.txt` → 404). Wave buoys have numeric ids, so this rarely matters.
8. **What the number means.** WVHT is significant wave height (the average of the highest third of waves), which isn't the face height surfers report. Present it as a buoy reading.
9. **The station XML has no wave flag.** `met="y"` means weather data, not waves. Coordinates have 3 decimal places.

## 8. Suggested first implementation (fits the current architecture)

1. **`ndbc-stations.service.loadBuoys()`**, awaited in `start()` next to `loadStations()`.
   - Fetch `activestations.xml` and the `realtime2/` listing.
   - Keep the stations whose `id.toUpperCase()` has a `.spec` file (about 245 worldwide).
   - Store `{ id, name, lat, lng }` in a module-level array.
   - The XML is simple self-closing `<station .../>` tags, so a small regex parser works without an XML dependency.
2. **`findBuoy(lat, lng, maxMiles = 50)`**: reuse `util/haversine.ts`; return the nearest buoy or `null`.
3. **`ndbc-swell.service.getLatestSwell(buoy)`.**
   - Fetch `realtime2/{ID}.spec`, skip the `#` lines, split on whitespace, and take the first row where WVHT isn't `MM`.
   - Map it to `SwellReading { time (ISO UTC), waveHeightM, swellHeightM, swellPeriodS, swellDirection (compass + degrees), windWaveHeightM, windWavePeriodS, windWaveDirection, meanWaveDirectionDeg, steepness }`, using `null` for `MM`, `-99` and `N/A`.
   - Add `isStale` based on the reading's age.
   - Return `null` on failure (logged), matching the tide service.
4. **Add `buoy` and `swell` to `ConditionsResponse`.**
5. **Later:**
   - fall back to the next-nearest buoy when the reading is stale or the file returns 404;
   - an NWS gridpoint forecast (moving the point offshore);
   - CDIP MOP for California.

## Open questions

- **RI buoy choice.** Should 44097 (37 mi) be preferred over 44085 (22 mi)? That needs either exposure-aware selection or a manual override table.
- **Buoy distance limit.** Should `maxMiles` be larger for buoys than for tide stations?
- **Finding a marine NWS grid cell.** How do you find the nearest marine cell automatically (step offshore along a bearing until the values are non-zero?) *[open design question]*
- **`wavePeriod2`.** What it means in NWS gridpoints is *[unverified]*.
- **CDIP MOP points.** How to map a CA lat/lng to a MOP point id. That needs a station index; not investigated.
- **NDBC rate limits and terms of use.** Nothing documented was found. Cache each buoy for about 10–15 minutes to be polite (this matches `max-age=600`).
