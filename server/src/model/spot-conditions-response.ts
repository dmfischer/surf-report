import { Buoy } from "./buoy";
import { HourRating } from "./hour-rating";
import { LatLng } from "./lat-lng";
import { Spot } from "./spot";
import { Station } from "./station";
import { SwellForecast } from "./swell-forecast";
import { SwellReading } from "./swell-reading";
import { TideLevel } from "./tide-level";
import { WindForecast } from "./wind-forecast";

// GET /api/spots/:spotId/conditions. Every data source is looked up from the spot itself, not a zip code.
// Each part degrades on its own: if one source is unavailable, its field is null or empty.
export interface SpotConditionsResponse {
    spot: Spot;
    // Nearest NOAA reference tide station to the spot; null if none within 50 miles.
    station: Station | null;
    stationDistanceMiles: number | null;
    tideLevels: TideLevel[];
    // NWS forecast at the spot, covering the same hours as tideLevels.
    windForecast: WindForecast[];
    // The spot's chosen buoy (spot.buoyId) and its latest measured reading.
    buoy: Buoy | null;
    swell: SwellReading | null;
    // Open-Meteo's ocean grid cell nearest the spot, and its hourly forecast (same hours as tideLevels).
    swellForecastLocation: LatLng | null;
    swellForecast: SwellForecast[];
    // One good/fair/poor rating per swellForecast hour, from swell (vs the spot's window) and wind
    // (vs the way the spot faces). Tide isn't rated yet. Empty if there's no swell forecast.
    ratings: HourRating[];
}
