# Code review backlog

Findings from the `/code-review` of `feature/noaa-endpoint` (2026-11-01) that are not yet addressed.

Already in progress on their own branches, so not listed here:
- #1, #2, #5: NOAA error handling, JSON error middleware, fetch timeouts → `feature/noaa-error-handling`
- #6: station time zones → `feature/station-timezones`
- #9: maximum station distance → `feature/max-station-distance`

---

## Worth doing (low risk)

### #4: `loadStations` doesn't check for NOAA's 200-with-error body
**Where:** `server/src/service/noaa-stations.service.ts`, `loadStations`

NOAA can return HTTP 200 with `{ error: { message } }` instead of data. `loadStations` only checks `response.ok`, so `body.stations` is `undefined` and `stations.length` throws `TypeError: Cannot read properties of undefined`. Startup still fails, which is correct, but with a confusing error instead of NOAA's message.

**Fix:** after parsing, check that `body.stations` exists and throw an `Error` that includes `body.error?.message`. This is the same pattern `getTideLevels` already uses.

### #3: All of NOAA's station fields leak into the API response
**Where:** `server/src/service/noaa-stations.service.ts`, `loadStations`

The raw NOAA response is cast to `Station[]` and stored as-is. Each station keeps about 20 NOAA fields (`tidepredoffsets`, `reference_id`, `timezonecorr`, `self`, `expand`, …), and all of them end up in `ConditionsResponse.station`. That breaks the `CLAUDE.md` convention of keeping NOAA's shapes private to the service. Nothing checks the types either, so a `lat`/`lng` that arrived as a string or `null` would silently corrupt the haversine maths.

**Fix:** declare a private `NoaaStation` interface for the raw shape, then `.map()` to our `Station` (`id`, `name`, `state`, `lat`, `lng`, `type`) in `loadStations`. Optionally skip stations whose `lat` or `lng` isn't a finite number.

> Note: `feature/station-timezones` may add a field to `Station`. Do this after merging it, and include that field in the mapping.

---

## Low priority / revisit later

### #7: `getStations()` re-filters the full list on every uncached lookup
**Where:** `server/src/service/noaa-stations.service.ts`, `getStations`

Each new zip code filters about 3,500 stations down to about 1,260 reference stations, building a new array each time. The cost is negligible today.

**Fix (if wanted):** filter once in `loadStations` into a `referenceStations` array, and have `getStations()` return the right array.

### #8: Tide predictions aren't cached
**Where:** `server/src/service/noaa-tides.service.ts`, `getTideLevels`

Predictions are deterministic for a given station and `begin_date`, but every request makes a fresh NOAA call. That adds latency and could hit NOAA rate limits once there's real traffic.

**Fix (when needed):** a module-level `Map` keyed by `` `${station.id}:${beginDate}` ``. Entries go out of date when the date rolls over, so either include the date in the key (as above) and clear old keys, or use a small TTL.

### #10: `TidePrediction` model is unused
**Where:** `server/src/model/tide-prediction.ts`

Kept on purpose for the high/low tide markers (see `CLAUDE.md`). The reviewer suggests adding it in the PR that uses it instead. Either keep it, or delete it now and recreate it with the high/low feature.
