# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Surf report app: enter a zip code, pick a nearby surf spot, and see that spot's tides, wind, measured swell, swell forecast and an hourly good/fair/poor rating. Gear recommendations are planned. Two independent npm projects, each with its own `package.json` and `node_modules`:

- `server/` — Express 5 + TypeScript API (CommonJS, run via `tsx`)
- `client/` — React 19 + Vite + TypeScript, Recharts (tide chart), MapLibre via `@vis.gl/react-maplibre` (maps)

## Commands

```bash
# server (port 3001)
cd server && npm run dev          # tsx watch src/index.ts
cd server && npx tsc --noEmit     # type-check (tsx does not type-check)
cd server && npm test             # Vitest, run once (npm run test:watch to re-run on save)

# client (Vite dev server, port 5173; proxies /api to localhost:3001)
cd client && npm run dev
cd client && npm run build        # tsc -b && vite build
cd client && npm run lint
```

- Tests live next to the code they test (`*.test.ts`) and import `describe`/`it`/`expect` from `vitest` explicitly. Only the server has tests; the client has none yet.
- **Vitest from Git Bash on Windows:** if the shell's working directory has a lowercase drive (`c:\…`), Vitest loads itself twice and every suite fails with `Cannot read properties of undefined (reading 'config')` or "failed to find the current suite". Run from `/C/Users/...` (uppercase) or from PowerShell. Not a project bug.
- To check a service against live APIs without starting the server (and port 3001), use a throwaway `tsx` script outside the repo; call `loadStations()`/`loadBuoys()` first if it needs them.

## Server architecture

### Routes (`index.ts`)

| Route | Purpose |
|---|---|
| `GET /api/spots?zip=` | `spots.service.findSpotsNear` → `SpotsResponse`: zip location plus spots within 25 mi, nearest first. Pure lookup, no external calls. 400 if `zip` is missing |
| `GET /api/spots/:spotId/conditions` | `spot-conditions.service.getSpotConditions` → `SpotConditionsResponse`. 404 for an unknown spot id |
| `GET /api/conditions/:zipCode` | Zip-based report (`noaa-conditions.service.getConditions`). The client's **fallback** for zips with no spots defined |
| `GET /health` | Liveness |

`index.ts` registers a JSON error middleware after the routes, so unhandled errors return `500 {"error":"Internal server error"}` (details logged, never sent to the client).

### Startup

`start()` awaits `Promise.all([loadStations(), loadBuoys()])` **before** `app.listen()` (top-level `await` is unavailable: CommonJS).
- `loadStations()` fetches ~3,500 NOAA tide stations into a module-level array and derives each one's IANA `timeZone` from lat/lng with `@photostructure/tz-lookup` (NOAA gives none). **Failure exits the process.**
- `loadBuoys()` fetches NDBC `activestations.xml` and the `realtime2/` directory listing, keeping the ~250 stations that have a `.spec` (wave) file. **Failure is logged and the server starts anyway**; buoy lookups then return nothing.

### Spots

- `data/spots.ts` is the hand-curated list (a `.ts` file, not JSON, so entries are type-checked against `model/spot.ts`). Currently four Narragansett, RI spots. Its header comment records where each value came from; keep that up to date.
- `facingDeg` (the way the break faces, out to sea) was measured from the OpenStreetMap coastline: OSM coastline ways have land on the left and water on the right, so segment bearing + 90° points seaward; average over ~300–700 m. Point breaks need judgement (Point Judith uses only its east side, where it's surfed).
- `swellWindowMinDeg`/`MaxDeg` are **estimates**, clockwise from min to max (may cross north). Point Judith's needs revisiting with the developer.
- `buoyId` is chosen per spot, not nearest: for RI it's 44097 Block Island, because the nearer 44085 is in sheltered Buzzards Bay.

### Spot conditions (`getSpotConditions`)

Every location comes from the spot; four independent requests run with `Promise.all`:
1. Tides: `findNearestStation(spot)` (≤ 50 mi) → `noaa-tides.getTideLevels(station)`: one week hourly from the **station's** local midnight (169 points), ISO UTC times.
2. Wind: `nws-gridpoints.getGridpointData(spot)` (two NWS requests: `/points` then `/gridpoints`) → `nws-wind.getWindForecast(gridData)`: hourly mph. The gridpoint fetch is separate from wind parsing because the same response also has wave layers.
3. Measured swell: `ndbc-buoys.getBuoy(spot.buoyId)` → `ndbc-swell.getLatestSwell(buoy)`: newest `.spec` row (feet).
4. Swell forecast: `open-meteo-swell.getSwellForecast(spot)` → hourly primary/secondary swell and wind waves (feet), from the nearest **ocean** grid cell.

Wind and swell forecasts are trimmed to the tide hours with `util/forecast-window.trimToTideHours` so everything shares one x-axis. Then `util/rating.rateHours(spot, swellForecast, windForecast)` gives one `HourRating` per hour:
- Swell: rate primary and secondary, keep the **better**; poor if outside the spot's swell window, < 1.5 ft or < 6 s; good if ≥ 3 ft and ≥ 9 s; else fair.
- Wind: < 6 mph good; offshore (within 45° of `facingDeg + 180`) good; onshore > 12 mph poor; cross-shore or light onshore fair.
- Overall = the **worst** factor; `reasons[]` explains each. Tide isn't rated yet. Thresholds are named constants at the top of `rating.ts`.

The zip report (`getConditions`) is the older flow: nearest station and nearest buoy (`findBuoy`, ≤ 50 mi) to the zip center, wind and forecast at the zip center, no ratings.

### Conventions

- `model/` holds plain-data `interface`s (not classes) for **our** shapes. Raw API shapes (NOAA `t`/`v`, NWS `validTime`, Open-Meteo parallel arrays, NDBC columns) stay private to the service that fetches them and are mapped there. Exception: `NwsGridpointData` is exported from `nws-gridpoints.service` for the `nws-*` services only.
- Services are plain exported functions; module-level variables are in-memory caches.
- Every service **returns `[]` or `null` on failure (logged, not thrown)**, so one source being down never fails the whole response. Each response field degrades on its own.
- Pure parsing and calculation go in `util/` with tests (`nws.ts`, `ndbc.ts`, `rating.ts`, `forecast-window.ts`, `haversine.ts`).
- `fetch` is Node's built-in; query strings via `URLSearchParams`; every external fetch passes `signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)` (10 s).
- Units: wind in **mph**, waves in **feet**, periods in seconds, directions in degrees the wind/swell comes **from**. Times are ISO 8601 UTC; compare them with `Date.parse`, not as strings (some end `…:00Z`, others `…:00.000Z`).
- Do time-zone math with `Intl.DateTimeFormat({ timeZone })`, not hand-written UTC offsets.

## API gotchas

### NOAA CO-OPS (tides)
- Two APIs: Metadata (`/mdapi/prod/webapi/…`) and Data (`/api/prod/datagetter`), with different base paths.
- Station `type`: `"R"` (reference, ~1,260) vs `"S"` (subordinate, ~2,240). **Subordinate stations only support `interval=hilo` with `datum=MLLW`**; hourly predictions fail with a misleading "Please make sure the Datum input is valid". `getStations()` filters to `"R"`.
- "No data" comes back as **HTTP 200** with `{ error: { message } }`; check for the expected key, not just `response.ok`.
- `date=today` silently ignores `range`; use `begin_date` + `range=<hours>` (inclusive: 168 → 169 points).
- Values are strings (`"v":"3.87"`). We request `time_zone=gmt` (station-local times skip/repeat hours at DST); `begin_date` is the UTC instant of the station's local midnight, `"YYYYMMDD HH:mm"`.
- The tz lookup is wrong for a few small Pacific islands (e.g. Pago Pago).

### NWS api.weather.gov (wind)
- Requires an identifying `User-Agent` (Node's default is just `node`). We send a generic one; don't put personal contact details in it.
- `/points/{lat},{lng}` accepts at most 4 decimals; returns 404 for open ocean. `properties.type` is `"land"` or `"marine"`.
- Gridpoint layers are lists of `{ validTime: "2026-11-15T02:00:00+00:00/PT3H", value }`: a start plus an ISO 8601 duration, with consecutive equal hours merged, so layers have different lengths. `util/nws.expandLayer` expands them to one value per hour before joining.
- Speeds are **km/h** (`uom: "wmoUnit:km_h-1"`), whole knots converted, so we round to whole mph. The service checks `uom` and returns `[]` if it changes.
- Wind exists for land and marine cells. **Wave layers are only non-zero in marine cells**, land cells report `0`, and the Boston (BOX) and NY (OKX) offices have no swell partitions at all. Hence Open-Meteo for the swell forecast.
- HTTP/2 responses have an empty `statusText`.

### NDBC (buoys)
- No JSON API. `activestations.xml` is flat self-closing tags (parsed with regex in `util/ndbc.ts`); it has no "reports waves" flag, so wave buoys are found via `.spec` files in the `realtime2/` listing.
- `realtime2/{ID}.spec`: whitespace-separated, two `#` header lines, **newest row first**, 45 days. File names are uppercase. Columns are located by name from the `#YY` header.
- Missing values are `MM`, `-99` and `N/A`. `SwD`/`WWD` are 16-point compass text, not degrees, despite the header.
- `WVHT` is significant wave height at the buoy, not surf face height. Measurements only, no forecast.

### Open-Meteo Marine (swell forecast)
- **Free tier is non-commercial only**, and the data (CC BY 4.0) must be credited: the client shows "Swell forecast: Open-Meteo.com". Limits ~10,000 calls/day.
- Pass `cell_selection=sea`; without it, land points return `null` for every height (directions are still filled in).
- Response is parallel arrays (`hourly.time[i]` goes with `hourly.swell_wave_height[i]`, …). With `timezone=GMT`, times look like `"2026-11-15T08:00"` (no `Z`); we append `:00Z`.
- Grid is ~9 km (0.083°): nearby spots can share one offshore cell (Scarborough and Point Judith do). Models disagree a lot in the Southern California Bight.

## Client architecture

- `ConditionsReport` owns the page state: zip search → `getSpots(zip)`. If there are spots, it shows `SpotsMap` and loads `getSpotConditions(id)` on selection; otherwise it falls back to `getConditions(zip)` (tide chart + `StationMap`).
- **Shared hover:** `TideChart` reports the hovered timestamp up (`onHoverTimeChange`); `ConditionsReport` keeps `hoveredTime` ("lifting state up") and passes the matching hour (`findHourAt`) to the wind arrow, the swell forecast caption and the rating caption. When not hovering it uses `loadedAt` (set in the event handler; render code must stay pure, so no `Date.now()` there).
- Overlapping spot clicks: a `useRef` (`latestSpotRequest`) makes late answers for a previously clicked spot get ignored.
- Components render conditional siblings as `{cond && <X/>}` so the map keeps its position and isn't rebuilt when the chart appears.
- `WindArrowMarker` (shared by both maps): an SVG arrow whose length follows speed and thickness follows gusts (`utils/wind-arrow`), rotated the short way round (`hooks/useShortestRotation`). Marker stacking uses explicit `zIndex` on each `<Marker>` (arrow 1, dots 2, spot pins 3–4), because MapLibre otherwise stacks markers in the order they were added.
- Rating bands: `utils/rating-bands` merges equal consecutive hours; `TideChart` draws them as Recharts `<ReferenceArea>`s, coloured in CSS (`.rating-band--good` etc.) so they can use the theme variables, with dark-mode values in `index.css`.
- `client/src/types/*.ts` are hand-copied from `server/src/model/`: **keep them in sync** when the API changes.

## Known gaps / planned work

- Tide isn't part of the rating; spots have no preferred tide or size range yet.
- Swell windows are estimates; Point Judith's especially needs revisiting.
- Only RI spots exist; other zips use the zip report fallback (no ratings).
- The NWS `/points` lookup never changes for a location but isn't cached; nothing else is cached either.
- `model/tide-prediction.ts` (high/low) is unused; intended for high/low markers.
- Planned LLM-generated weekly write-up (data to send, guardrails, API-key protection, build order): `docs/llm-weekly-writeup.md`.
- Remaining code-review findings: `docs/code-review-backlog.md`. Research notes (buoys, wind, maps, spots): `docs/research/`.

## Working with the developer

The developer is using this project to learn Node.js, TypeScript and React. Prefer incremental changes — one small step at a time with an explanation of *why* — over large all-at-once edits, and wait for a go-ahead before changing code when asked to review or suggest. Ask rather than guess on surf-local knowledge (spot locations, which way breaks face, swell windows): the developer knows these breaks.

## Sub-agents in worktrees

When delegating code changes to sub-agents with worktree isolation:

- Worktrees are created under `.claude/worktrees/` (gitignored) on an auto-named `worktree-agent-*` branch. Have each agent first run `git switch -c feature/<name>` and commit there; agents don't push.
- Parallel agents must not start the server (they'd all compete for port 3001). Verify with `npx tsc --noEmit` and throwaway `tsx` scripts outside the repo. Each worktree needs its own `npm ci`.
- Parallel agents shouldn't edit `CLAUDE.md`. Have them report doc changes, and update it once after their branches are merged.
- **Cleanup once an agent's work is verified:** a branch checked out in a worktree can't be checked out in the main folder, so remove the worktree and delete the leftover auto-named branch. The `feature/*` branch and its commits are kept:
  ```bash
  git worktree remove --force .claude/worktrees/<agent-dir>   # --force: worktree contains node_modules
  git branch -d worktree-agent-<id>
  ```
  Check `git worktree list` and `git branch -vv` before and after.
