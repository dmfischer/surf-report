# Surf Report

Look up surf conditions for a U.S. zip code: a week of hourly tides from the nearest NOAA tide station, an hourly wind forecast from the National Weather Service, and a map of where the data comes from. Gear recommendations and swell data are planned.

## Features

- **Zip code lookup:** finds the nearest NOAA reference tide station within 50 miles.
- **Tide chart:** hourly tide heights for the next 7 days, shown in the station's local time.
- **Wind forecast:** hourly speed, gusts (mph) and direction from the NWS gridpoint forecast, covering the same hours as the tides.
- **Station map:** shows the zip code's location, the tide station, and the distance between them.

No API keys or accounts are needed: every data source is free and public.

## Getting started

You need [Node.js](https://nodejs.org/) 20 or later. The server and client are separate npm projects, so install and run each one in its own terminal.

```bash
# Terminal 1: API server on http://localhost:3001
cd server
npm install
npm run dev
```

```bash
# Terminal 2: web app on http://localhost:5173
cd client
npm install
npm run dev
```

Open http://localhost:5173 and enter a coastal zip code, such as `92651` (Laguna Beach, CA) or `02882` (Narragansett, RI).

The server downloads NOAA's station list when it starts, so give it a few seconds before searching. The client's dev server forwards `/api` requests to port 3001, so the server must be running too.

## API

### `GET /api/conditions/:zipCode`

```bash
curl http://localhost:3001/api/conditions/92651
```

```jsonc
{
  "zipCode": "92651",
  "status": "ok",                  // "ok" | "unknown_zip" | "no_nearby_station"
  "message": null,                 // explanation when status isn't "ok"
  "description": "flat",           // placeholder for now
  "zipLocation": { "lat": 33.5429, "lng": -117.7813 },
  "station": { "id": "9410580", "name": "Newport Bay Entrance, Corona del Mar", "timeZone": "America/Los_Angeles", ... },
  "stationDistanceMiles": 7.2,
  "tideLevels": [
    { "time": "2026-11-15T08:00:00Z", "height": 2.61 },   // feet above MLLW
    ...                                                   // 169 hourly values
  ],
  "windForecast": [
    { "time": "2026-11-15T08:00:00.000Z", "speedMph": 5, "gustMph": 10, "directionDeg": 60 },
    ...
  ]
}
```

- Unknown zip codes and zip codes with no station nearby still return HTTP 200, with `status` set and `station: null`. Check `status` before reading the rest.
- Times are UTC. `directionDeg` is the direction the wind blows **from** (0 = north).
- If a data source is unavailable, its list is empty instead of the whole request failing.

### `GET /health`

Returns `200` when the server is up.

## Development

| | Command | |
|---|---|---|
| Server | `npm run dev` | Start with auto-reload |
| | `npm test` | Run unit tests ([Vitest](https://vitest.dev/)) |
| | `npm run test:watch` | Re-run tests on every save |
| | `npx tsc --noEmit` | Type-check (`npm run dev` doesn't) |
| Client | `npm run dev` | Start the Vite dev server |
| | `npm run build` | Type-check and build for production |
| | `npm run lint` | Run ESLint |

### Project structure

```
server/                 Express 5 + TypeScript API
  src/index.ts          Startup and routes
  src/model/            Response shapes returned by the API
  src/service/          One file per data source (NOAA tides and stations, NWS forecasts)
  src/util/             Small pure helpers (distance, NWS time parsing)
client/                 React 19 + Vite + TypeScript
  src/components/       Zip form, tide chart (Recharts), station map (MapLibre)
  src/services/         Calls to the API
docs/research/          Notes on data sources (buoys, wind, maps, surf spots)
```

## Data sources

| Data | Source |
|---|---|
| Tide stations and predictions | [NOAA CO-OPS](https://tidesandcurrents.noaa.gov/) Metadata and Data APIs |
| Wind forecast | [National Weather Service API](https://www.weather.gov/documentation/services-web-api) (api.weather.gov) |
| Zip code locations | [`zipcodes`](https://www.npmjs.com/package/zipcodes) npm package (offline) |
| Map tiles | [OpenFreeMap](https://openfreemap.org/), with data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors |

Tide predictions are not official navigation data. Don't rely on this app for safety at sea.

## Roadmap

- Wind chart in the web app
- Swell data from NDBC buoys
- Surf spots with "is it working?" ratings from swell, wind and tide
- Gear recommendations

## License

[Apache 2.0](LICENSE)
