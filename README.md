# Surf Report

Find out whether it's worth paddling out. Enter a U.S. zip code, pick a nearby surf spot, and see a week of hourly conditions for that spot: tides, wind, the latest buoy reading, a swell forecast, and a good / fair / poor rating for every hour. A short AI-written outlook compares the spots for the week ahead. Gear recommendations are planned.

## Features

- **Spots near a zip code:** a map and list of hand-curated surf spots, with each break's type and the direction it faces. Spots are currently defined for Narragansett, RI (`02882`). Other zip codes get a simpler zip-based report (see below).
- **Hourly rating:** green, yellow and red bands behind the tide chart, with the reasons spelled out for each hour, e.g. *"Poor: Swell 0.9 ft @ 3 s from WSW (can't reach this spot) · Wind 12 mph from NW (offshore)"*. The rating combines:
  - **swell:** size, period, and whether its direction can reach the spot,
  - **wind:** speed, and whether it's offshore, cross-shore or onshore for the way the spot faces.
- **Tide chart:** hourly tide heights for the next 7 days from the nearest NOAA station, in local time.
- **Wind at the spot:** an arrow on the map that points the way the wind is blowing. Its length follows the speed and its thickness the gusts.
- **Swell:** the latest measurement from the spot's chosen buoy, plus an hourly forecast of primary and secondary swell.
- **Hover the tide chart** to see the rating, wind and swell forecast for any hour.
- **Weekly outlook:** a short write-up of the coming week across all the spots, e.g. *"Small until Thursday, then a clean southeast swell makes Friday the day"*, with the best spot and time of day for each day worth surfing. Claude writes it from the app's own ratings and data, three times a day; it's labelled as AI-generated and shows when it was written. Optional: it needs an Anthropic API key (see below).

**Zip-based report:** for zip codes with no spots defined yet (for example `92651`, Laguna Beach), you get the tides, wind and swell for the zip code itself, without ratings.

Everything except the weekly outlook works without API keys or accounts.

## Getting started

You need [Node.js](https://nodejs.org/) 22.9 or later. The server and client are separate npm projects, so install and run each one in its own terminal.

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

Open http://localhost:5173 and enter `02882` (Narragansett, RI) to see the spots, or another coastal zip code such as `92651` (Laguna Beach, CA) for the zip-based report.

The server downloads NOAA's tide stations and NDBC's buoy list when it starts, so give it a few seconds before searching. The client's dev server forwards `/api` requests to port 3001, so the server must be running too.

### The weekly outlook (optional)

The outlook is written by [Claude](https://www.anthropic.com/claude) (Claude Opus 5.5) through the Anthropic API, which is billed separately from a Claude Pro or Max subscription. At three write-ups a day it costs roughly $5–6 a month. It's off unless you turn it on:

1. In the [Claude Console](https://console.anthropic.com/), create a workspace with a monthly spend limit and an API key in it.
2. Copy `server/.env.example` to `server/.env`, then set `ANTHROPIC_API_KEY` and `WRITEUP_ENABLED=true`. `npm run dev` loads this file; it's gitignored. Keep the key on the server only, and never give it a `VITE_` prefix, which would build it into the public JavaScript.

The server then writes an outlook when it starts (unless the saved one is still current) and again at 4 am, 12 pm and 8 pm New York time, and saves it to `server/.cache/writeup.json`, so restarts don't call the API again. Visitors only ever get the saved copy.

To see the panel without a key, run `npm run writeup:example` in `server/`: it copies a sample outlook into place.

## API

All times are UTC. Directions are in degrees that the wind or swell comes **from** (0 = north). Wind is in mph, waves in feet. If one data source is unavailable, only its fields come back empty (`[]` or `null`); the rest of the response is still filled in.

### `GET /api/spots?zip=02882`

The spots within 25 miles of the zip code, nearest first. An empty `spots` list means none are defined nearby yet.

```jsonc
{
  "zipCode": "02882",
  "status": "ok",                       // "ok" | "unknown_zip"
  "message": null,
  "zipLocation": { "lat": 41.4353, "lng": -71.4616 },
  "spots": [
    {
      "id": "narragansett-town-beach",
      "name": "Narragansett Town Beach",
      "lat": 41.4364, "lng": -71.4514,
      "breakType": "beach",             // "beach" | "point" | "reef"
      "facingDeg": 135,                 // the way the break faces, out to sea
      "swellWindowMinDeg": 90,          // swell directions that can reach it
      "swellWindowMaxDeg": 200,
      "buoyId": "44097",                // the buoy that best represents its swell
      "distanceMiles": 0.5
    },
    ...
  ]
}
```

### `GET /api/spots/:spotId/conditions`

Everything for one spot. Returns 404 for an unknown spot id.

```jsonc
{
  "spot": { "id": "matunuck", "name": "Matunuck", "facingDeg": 175, ... },
  "station": { "id": "8455083", "name": "Point Judith, Harbor of Refuge", "timeZone": "America/New_York", ... },
  "stationDistanceMiles": 3.3,
  "tideLevels": [
    { "time": "2026-11-15T05:00:00Z", "height": 2.33 },   // feet above MLLW; 169 hourly values
    ...
  ],
  "windForecast": [                                      // NWS forecast at the spot
    { "time": "2026-11-15T15:00:00.000Z", "speedMph": 12, "gustMph": 17, "directionDeg": 320 },
    ...
  ],
  "buoy": { "id": "44097", "name": "Block Island, RI  (154)", ... },
  "swell": {                                             // the buoy's latest measurement
    "time": "2026-11-15T21:00:00.000Z",
    "waveHeightFt": 3.6,
    "swellHeightFt": 0.7, "swellPeriodS": 12.5, "swellDirection": "ESE",
    "windWaveHeightFt": 3.6, "windWavePeriodS": 4.7, "windWaveDirection": "W",
    "steepness": "VERY_STEEP"
  },
  "swellForecastLocation": { "lat": 41.291664, "lng": -71.54166 },   // the forecast's ocean grid cell
  "swellForecast": [
    {
      "time": "2026-11-15T05:00:00Z",
      "waveHeightFt": 2.1,
      "primarySwell": { "heightFt": 0.7, "periodS": 4.15, "directionDeg": 237 },
      "secondarySwell": { "heightFt": 0.6, "periodS": 4.2, "directionDeg": 226 },
      "windWaves": { "heightFt": 1.5, "periodS": 2.6, "directionDeg": 298 }
    },
    ...
  ],
  "ratings": [
    {
      "time": "2026-11-15T15:00:00Z",
      "rating": "poor",                                 // "good" | "fair" | "poor": the worst factor
      "swellRating": "poor",
      "windRating": "good",                             // null when there's no wind forecast
      "reasons": ["Swell 0.9 ft @ 3 s from WSW (can't reach this spot)", "Wind 12 mph from NW (offshore)"]
    },
    ...
  ]
}
```

### `GET /api/conditions/:zipCode`

The zip-based report used for zip codes without spots: the same tides, wind, buoy and forecast fields, located from the zip code's center (`zipLocation`) instead of a spot, using the nearest buoy and with no ratings. `status` is `"ok"`, `"unknown_zip"` or `"no_nearby_station"`, and unknown zip codes still return HTTP 200, so check `status` before reading the rest.

### `GET /api/writeup`

The saved weekly outlook. It never calls the AI model: it only returns the last saved write-up. Always HTTP 200; check `status`.

```jsonc
{
  "status": "ok",                          // or "not_available", with a "message"
  "region": "South County",
  "generatedAt": "2026-11-23T17:00:09.000Z",
  "writeup": {
    "headline": "Small and wind-affected until Thursday, then a clean southeast swell makes Friday and Saturday the days to go.",
    "days": [                              // only days worth surfing
      {
        "date": "2026-11-27",              // local date
        "summary": "The best day of the week...",
        "bestBets": [{ "spotId": "point-judith", "block": "afternoon" }]   // block: dawn | morning | afternoon | evening
      }
    ],
    "caveats": ["Friday's swell size depends on a storm that is still a long way offshore..."]
  }
}
```

### `GET /health`

Returns `200` when the server is up.

## How the rating works

Each hour gets a rating for swell and for wind, and the overall rating is the **worse** of the two: one bad factor, like strong onshore wind, spoils an otherwise good swell.

| | Poor | Fair | Good |
|---|---|---|---|
| **Swell** (the better of primary and secondary) | Outside the spot's swell window, under 1.5 ft, or under 6 s | 1.5–3 ft or 6–9 s | 3 ft or more at 9 s or more, inside the window |
| **Wind** | Onshore over 12 mph | Cross-shore, or onshore up to 12 mph | Under 6 mph, or offshore |

The thresholds and each spot's swell window are first estimates, to be tuned against days with known conditions. Tide isn't part of the rating yet.

### The weekly outlook

The app's own code does the judging, and the model only explains and compares. For each spot and each day, the server reduces the hourly data to four blocks (dawn 5–8, morning 8–12, afternoon 12–4, evening 4–7) and finds the tide highs and lows. The model gets only that summary (no user input ever reaches it) and must reply in a fixed JSON shape. Before the reply is saved, every best bet is checked against the ratings: a spot or block that isn't rated fair or good that day is removed. The plan and its reasoning are in [docs/llm-weekly-writeup.md](docs/llm-weekly-writeup.md).

## Development

| | Command | |
|---|---|---|
| Server | `npm run dev` | Start with auto-reload |
| | `npm test` | Run unit tests ([Vitest](https://vitest.dev/)) |
| | `npm run test:watch` | Re-run tests on every save |
| | `npx tsc --noEmit` | Type-check (`npm run dev` doesn't) |
| | `npm run writeup:example` | Save a sample weekly outlook, to see the panel without an API key |
| Client | `npm run dev` | Start the Vite dev server |
| | `npm run build` | Type-check and build for production |
| | `npm run lint` | Run ESLint |

### Adding a spot

Spots are defined by hand in [`server/src/data/spots.ts`](server/src/data/spots.ts). Each needs:
- a location,
- the direction the break faces,
- the range of swell directions that reach it,
- the buoy that best represents its swell. That's not always the nearest one: a nearer buoy can be sheltered from the swell that reaches the spot.

The comment at the top of the file explains how the existing values were found.

### Project structure

```
server/                 Express 5 + TypeScript API
  src/index.ts          Startup and routes
  src/data/             Hand-curated surf spots
  src/model/            Response shapes returned by the API
  src/service/          Fetching and orchestration, one folder per data source or feature:
                        ndbc/, noaa/, nws/, open-meteo/, spots/ (spot lookup, conditions), writeup/
  src/util/             Small pure helpers with tests, in matching folders: ndbc/, nws/,
                        rating/, writeup/ (week summary, prompt, schema, validation, schedule), geo/
  fixtures/             A sample weekly outlook (npm run writeup:example)
client/                 React 19 + Vite + TypeScript
  src/components/       Zip form, spots map, tide chart (Recharts), station map (MapLibre), captions,
                        weekly outlook panel
  src/hooks/            Custom React hooks (smooth arrow rotation)
  src/services/         Calls to the API
  src/types/            API response shapes (copied from server/src/model)
  src/utils/            Small pure helpers (compass directions, wind arrow, rating bands)
docs/                   Plan for the weekly outlook; research/ has notes on data sources
```

## Data sources

| Data | Source |
|---|---|
| Tide stations and predictions | [NOAA CO-OPS](https://tidesandcurrents.noaa.gov/) Metadata and Data APIs |
| Wind forecast | [National Weather Service API](https://www.weather.gov/documentation/services-web-api) (api.weather.gov) |
| Buoy measurements | [NOAA National Data Buoy Center](https://www.ndbc.noaa.gov/) realtime files |
| Swell forecast | [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); free for **non-commercial** use) |
| Weekly outlook | [Claude](https://www.anthropic.com/claude) (Anthropic API), written from the data above |
| Zip code locations | [`zipcodes`](https://www.npmjs.com/package/zipcodes) npm package (offline) |
| Spot coastline directions, map tiles | [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors; tiles by [OpenFreeMap](https://openfreemap.org/) |

Tide predictions and forecasts are not official navigation data. Don't rely on this app for safety at sea.

## Roadmap

- Tide in the rating, with a preferred tide for each spot
- Tuning swell windows and thresholds against real days
- More spots
- Gear recommendations

## License

[Apache 2.0](LICENSE)
