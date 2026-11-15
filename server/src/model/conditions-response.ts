import { Buoy } from "./buoy";
import { LatLng } from "./lat-lng";
import { Station } from "./station";
import { SwellForecast } from "./swell-forecast";
import { SwellReading } from "./swell-reading";
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
    // Nearest wave buoy within 50 miles; null if there's none (or status isn't "ok").
    buoy: Buoy | null;
    buoyDistanceMiles: number | null;
    // Hourly, covering the same hours as tideLevels (all available hours if there are no tides).
    // Empty unless status is "ok", or if NWS has no forecast for this location.
    windForecast: WindForecast[];
    // The buoy's latest measured reading (not a forecast). null when there's no buoy or it isn't reporting.
    swell: SwellReading | null;
    // Open-Meteo's ocean grid cell nearest the zip code: where swellForecast is for. null if unavailable.
    swellForecastLocation: LatLng | null;
    // Hourly, covering the same hours as tideLevels. Model output for open water near the coast,
    // not surf height at the beach. Empty if Open-Meteo is unavailable.
    swellForecast: SwellForecast[];
}