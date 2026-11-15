// Shapes of the JSON returned by GET /api/conditions/:zipCode.
// Copied from server/src/model/ — keep in sync when the API changes.

export interface TideLevel {
  // ISO 8601 instant in UTC, e.g. "2026-11-01T07:00:00Z".
  time: string
  // Feet above MLLW (can be negative at very low tides).
  height: number
}

export interface WindForecast {
  // ISO 8601 instant in UTC, e.g. "2026-11-15T02:00:00.000Z".
  time: string
  // null when NWS has no value for this hour.
  speedMph: number | null
  gustMph: number | null
  // Direction the wind blows FROM, in degrees: 0 = north, 90 = east.
  directionDeg: number | null
}

export interface Station {
  id: string
  name: string
  state: string
  lat: number
  lng: number
  type: 'R' | 'S'
  // IANA zone (e.g. "America/Los_Angeles") for showing times in station-local time.
  timeZone: string
}

// An NDBC wave buoy.
export interface Buoy {
  id: string
  name: string
  lat: number
  lng: number
}

export interface LatLng {
  lat: number
  lng: number
}

export type ConditionsStatus = 'ok' | 'unknown_zip' | 'no_nearby_station'

export interface ConditionsResponse {
  zipCode: string
  status: ConditionsStatus
  // Human-readable explanation when status isn't 'ok'; null when it is.
  message: string | null
  description: string
  // Center of the zip code; null unless status is 'ok'.
  zipLocation: LatLng | null
  // null unless status is 'ok'.
  station: Station | null
  stationDistanceMiles: number | null
  // Empty unless status is 'ok'.
  tideLevels: TideLevel[]
  // Nearest wave buoy within 50 miles; null if there's none (or status isn't 'ok').
  buoy: Buoy | null
  buoyDistanceMiles: number | null
  // Hourly, covering the same hours as tideLevels. Empty unless status is 'ok',
  // or if NWS has no forecast for this location.
  windForecast: WindForecast[]
}
