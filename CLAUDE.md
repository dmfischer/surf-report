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

1. `noaa-stations.service.findStation(zip)` — `zipcodes.lookup()` gives the zip's lat/lng (offline dataset, returns `undefined` for unknown zips → `null` station), then a linear scan over the cached NOAA station list using `util/haversine.ts` picks the nearest station. Results are cached per zip in a module-level `Map`.
2. `noaa-tides.service.getTideLevels(station)` — fetches one week of hourly tide predictions from the NOAA CO-OPS Data API and maps them to `TideLevel[]`. Returns `[]` on any failure (logged, not thrown).
3. `noaa-conditions.service.getConditions(zip)` composes these into a `ConditionsResponse`. `description` is still a hard-coded placeholder.

Startup: `index.ts` awaits `loadStations()` (fetches ~3,500 stations from the NOAA Metadata API into a module-level array) **before** `app.listen()`, and exits the process if that fails. Top-level `await` is unavailable because the server compiles to CommonJS, hence the `start()` wrapper.

Conventions:
- `model/` holds plain-data `interface`s (not classes). NOAA's raw response shapes (`t`, `v`, …) are private to the service that fetches them and are mapped to our own models there; don't let NOAA field names leak out of a service.
- Services are plain exported functions; module-level variables serve as in-memory caches.
- `fetch` is Node's built-in; query strings are built with `URLSearchParams`.

## NOAA API gotchas

- Two APIs: Metadata (`/mdapi/prod/webapi/…`, station lists/details) and Data (`/api/prod/datagetter`, readings and predictions). They have different base paths.
- Station `type`: `"R"` (reference/harmonic, ~1,260) vs `"S"` (subordinate, ~2,240). **Subordinate stations only support `interval=hilo` with `datum=MLLW`**; hourly/6-minute predictions fail with a misleading "Please make sure the Datum input is valid" error. `getStations()` therefore filters to `"R"` by default (`getStations(true)` includes subordinates).
- "No data" responses come back as **HTTP 200** with an `{ error: { message } }` body — always check for the expected key, not just `response.ok`.
- `date=today` silently ignores `range`; use `begin_date=YYYYMMDD&range=<hours>`. The range is inclusive (168 hours → 169 points).
- `type: "H" | "L"` on predictions only appears with `interval=hilo`.
- All values are strings (`"v":"3.87"`); convert with `Number()`.
- With `time_zone=lst_ldt`, times are station-local strings with no UTC offset (`"2026-10-23 06:56"`). They are passed through as strings for now; `begin_date` is computed from the server's local date. Proper time zone handling is deferred.
- Sensor products (`water_level`, `water_temperature`, `wind`, …) exist only at some stations; `predictions` works everywhere (within the R/S limits above).
- Wave/swell data is not in CO-OPS at all — planned source is NDBC buoys.

## Known gaps / planned work

- Client is not wired to the API yet. Plan: Vite proxy to `localhost:3001` (avoids CORS) and a Recharts line chart of `tideLevels`. API routes live under `/api`; `/health` stays at the root.
- `findStation` has no maximum distance, so inland zips return a far-away coastal station.
- Unknown zips return 200 with `station: null`, not 404.
- `model/tide-prediction.ts` (high/low with `type`) is currently unused; intended for high/low markers.

## Working with the developer

The developer is using this project to learn Node.js and TypeScript. Prefer incremental changes — one small step at a time with an explanation of *why* — over large all-at-once edits, and wait for a go-ahead before changing code when asked to review or suggest.
