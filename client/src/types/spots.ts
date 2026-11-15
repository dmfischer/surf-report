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
  // One rating per swellForecast hour (swell vs the spot's window, wind vs the way it faces).
  ratings: HourRating[]
}

export type Rating = 'good' | 'fair' | 'poor'

// How surfable a spot is likely to be in one hour (green / yellow / red).
export interface HourRating {
  // ISO 8601 instant in UTC.
  time: string
  // The worst of the swell and wind ratings.
  rating: Rating
  swellRating: Rating
  // null when there's no wind forecast for this hour.
  windRating: Rating | null
  // e.g. "Swell 3.3 ft @ 11 s from S (in window)", "Wind 8 mph from NW (offshore)".
  reasons: string[]
}
