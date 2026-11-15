import { LatLng } from "./lat-lng";
import { Station } from "./station";
import { TideLevel } from "./tide-level";
import { WindForecast } from "./wind-forecast";

export interface ConditionsResponse {
    zipCode: string;
    status: "ok" | "unknown_zip" | "no_nearby_station";
    message: string | null;
    description: string;
    // Center of the zip code; null unless status is "ok".
    zipLocation: LatLng | null;
    station: Station | null;
    stationDistanceMiles: number | null;
    tideLevels: TideLevel[];
    // Hourly, covering the same hours as tideLevels (all available hours if there are no tides).
    // Empty unless status is "ok", or if NWS has no forecast for this location.
    windForecast: WindForecast[];
}