# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Surf report app: look up local conditions by zip code and (eventually) recommend gear. Two independent npm projects, each with its own `package.json` and `node_modules`:

- `server/` — Express 5 + TypeScript API (CommonJS, run via `tsx`)
- `client/` — React 19 + Vite + TypeScript (still the stock Vite template; no API calls yet)

## Commands

There is no test suite yet in either project.

```bash
# server (port 3001)
cd server && npm run dev          # tsx watch src/index.ts
cd server && npx tsc --noEmit     # type-check (tsx does not type-check)

# client (Vite dev server, port 5173)
cd client && npm run dev
cd client && npm run build        # tsc -b && vite build
cd client && npm run lint
```

## Server architecture

Request flow for `GET /api/conditions/:zipCode`:

1. `noaa-stations.service.findStation(zip, maxDistanceMiles = DEFAULT_MAX_STATION_DISTANCE_MILES)` (50) returns a `StationLookup` union: `{ status: "ok", station, distanceMiles }`, `{ status: "unknown_zip" }` (`zipcodes.lookup()`, an offline dataset, doesn't know the zip), or `{ status: "no_nearby_station" }` (nearest reference station is beyond the limit). The nearest station is found by a linear haversine scan (`util/haversine.ts`). The per-zip cache stores the nearest station and its distance regardless of the limit, and the limit is applied on read, so different limits can't get a wrong cached answer.
2. `noaa-tides.service.getTideLevels(station)` fetches one week of hourly tide predictions, starting at the **station's** local midnight, and maps them to `TideLevel[]` with ISO UTC `time`s. Returns `[]` on any failure (logged, not thrown): HTTP errors, NOAA's 200-with-error body, network errors, non-JSON bodies, and timeouts.
3. `noaa-conditions.service.getConditions(zip)` composes these into a `ConditionsResponse` with `status` (`"ok" | "unknown_zip" | "no_nearby_station"`), `message` (human-readable; `null` when ok), `station`, `stationDistanceMiles` (1 decimal), and `tideLevels`. NOAA isn't called when there's no station. `description` is still a hard-coded placeholder.

Startup: `index.ts` awaits `loadStations()` (fetches ~3,500 stations from the NOAA Metadata API into a module-level array) **before** `app.listen()`, and exits the process if that fails or times out. `loadStations` also derives each station's IANA `timeZone` from its lat/lng with `@photostructure/tz-lookup`, since NOAA provides no zone name. Top-level `await` is unavailable because the server compiles to CommonJS, hence the `start()` wrapper.

Conventions:
- `model/` holds plain-data `interface`s (not classes). NOAA's raw response shapes (`t`, `v`, …) are private to the service that fetches them and are mapped to our own models there; don't let NOAA field names leak out of a service.
- Services are plain exported functions; module-level variables serve as in-memory caches.
- `fetch` is Node's built-in; query strings are built with `URLSearchParams`. Every NOAA fetch passes `signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)` (10s).
- `index.ts` registers a JSON error middleware after the routes, so unhandled errors return `500 {"error":"Internal server error"}` (details logged, never sent to the client) rather than Express's HTML page.
- Do time-zone math with `Intl.DateTimeFormat({ timeZone })`, not hand-written UTC offsets.

## NOAA API gotchas

- Two APIs: Metadata (`/mdapi/prod/webapi/…`, station lists/details) and Data (`/api/prod/datagetter`, readings and predictions). They have different base paths.
- Station `type`: `"R"` (reference/harmonic, ~1,260) vs `"S"` (subordinate, ~2,240). **Subordinate stations only support `interval=hilo` with `datum=MLLW`**; hourly/6-minute predictions fail with a misleading "Please make sure the Datum input is valid" error. `getStations()` therefore filters to `"R"` by default (`getStations(true)` includes subordinates).
- "No data" responses come back as **HTTP 200** with an `{ error: { message } }` body — always check for the expected key, not just `response.ok`.
- `date=today` silently ignores `range`; use `begin_date` + `range=<hours>`. The range is inclusive (168 hours → 169 points).
- `type: "H" | "L"` on predictions only appears with `interval=hilo`.
- All values are strings (`"v":"3.87"`); convert with `Number()`.
- Times: NOAA's `time_zone=lst_ldt` returns station-local strings with no offset, which skip or repeat hours on DST changes. We request `time_zone=gmt` instead; `begin_date` is then the UTC instant of the station's local midnight, formatted `"YYYYMMDD HH:mm"`, and NOAA's `"2026-11-01 07:00"` is reshaped to `TideLevel.time` = `"2026-11-01T07:00:00Z"`. Station-local display uses `Station.timeZone`.
- NOAA's station list has no IANA zone (only `timezonecorr`, a standard-time offset with no DST rules), hence the lat/lng lookup at load time. The lookup is wrong for a few small Pacific islands (e.g. Pago Pago).
- Sensor products (`water_level`, `water_temperature`, `wind`, …) exist only at some stations; `predictions` works everywhere (within the R/S limits above).
- Wave/swell data is not in CO-OPS at all — planned source is NDBC buoys.

## Known gaps / planned work

- Client is not wired to the API yet. Plan: Vite proxy to `localhost:3001` (avoids CORS) and a Recharts line chart of `tideLevels`. API routes live under `/api`; `/health` stays at the root.
- Unknown and out-of-range zips return HTTP 200 with `status: "unknown_zip"` or `"no_nearby_station"` and `station: null`. **Clients must check `status` before reading `station`.**
- `model/tide-prediction.ts` (high/low with `type`) is currently unused; intended for high/low markers.
- Remaining code-review findings, with suggested fixes: `docs/code-review-backlog.md`.
- Swell (NDBC/CDIP buoys) and wind (NWS gridpoints, CO-OPS `wind`) research and proposed first slices: `docs/research/`. Read these before starting either feature.

## Working with the developer

The developer is using this project to learn Node.js and TypeScript. Prefer incremental changes — one small step at a time with an explanation of *why* — over large all-at-once edits, and wait for a go-ahead before changing code when asked to review or suggest.

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
