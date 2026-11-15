// Shapes of the JSON returned by GET /api/spots?zip=.
// Copied from server/src/model/ — keep in sync when the API changes.
import type {
  Buoy, LatLng, Station, SwellForecast, SwellReading, TideLevel, WindForecast,
} from "./conditions";

export interface Spot {
  id: string
  name: string
  lat: number
  lng: number
  breakType: 'beach' | 'point' | 'reef'
  // Direction the break faces, out to sea, in degrees (0 = north, 90 = east).
  facingDeg: number
  // NDBC buoy that best represents this spot's swell.
  buoyId: string
}

export interface SpotNearby extends Spot {
  // Straight-line distance from the zip code's center.
  distanceMiles: number
}

export interface SpotsResponse {
  zipCode: string
  status: 'ok' | 'unknown_zip'
  message: string | null
  zipLocation: LatLng | null
  // Nearest first. Empty when no spots are defined near this zip yet: fall back to zip conditions.
  spots: SpotNearby[]
}

// GET /api/spots/:spotId/conditions. Every source is looked up from the spot; each part can be
// null or empty on its own if that source is unavailable.
export interface SpotConditionsResponse {
  spot: Spot
  // Nearest tide station to the spot; null if none within 50 miles.
  station: Station | null
  stationDistanceMiles: number | null
  tideLevels: TideLevel[]
  // NWS forecast at the spot, covering the same hours as tideLevels.
  windForecast: WindForecast[]
  // The spot's chosen buoy and its latest measured reading.
  buoy: Buoy | null
  swell: SwellReading | null
  // Open-Meteo's ocean cell nearest the spot, and its hourly forecast (same hours as tideLevels).
  swellForecastLocation: LatLng | null
  swellForecast: SwellForecast[]
}
