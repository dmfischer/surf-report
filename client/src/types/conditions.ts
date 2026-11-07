// Shapes of the JSON returned by GET /api/conditions/:zipCode.
// Copied from server/src/model/ — keep in sync when the API changes.

export interface TideLevel {
  // ISO 8601 instant in UTC, e.g. "2026-11-01T07:00:00Z".
  time: string
  // Feet above MLLW (can be negative at very low tides).
  height: number
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

export type ConditionsStatus = 'ok' | 'unknown_zip' | 'no_nearby_station'

export interface ConditionsResponse {
  zipCode: string
  status: ConditionsStatus
  // Human-readable explanation when status isn't 'ok'; null when it is.
  message: string | null
  description: string
  // null unless status is 'ok'.
  station: Station | null
  stationDistanceMiles: number | null
  // Empty unless status is 'ok'.
  tideLevels: TideLevel[]
}
