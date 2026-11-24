import { WindForecast } from "../../model/wind-forecast";
import { expandLayer } from "../../util/nws/nws";
import { NwsGridpointData } from "./nws-gridpoints.service";

const KMH_PER_MPH = 1.609344;

// The units we expect NWS to use; if they ever change, our conversions would silently be wrong.
const SPEED_UOM = "wmoUnit:km_h-1";
const DIRECTION_UOM = "wmoUnit:degree_(angle)";

// Turns the wind layers of NWS grid data (from getGridpointData) into one WindForecast per hour.
// No fetching here: the same grid data also holds the wave layers, so it's fetched once and shared.
// Returns [] on any problem (logged, not thrown), like getTideLevels.
export function getWindForecast(gridData: NwsGridpointData): WindForecast[] {
    const { windSpeed, windGust, windDirection } = gridData;
    if (!windSpeed || !windGust || !windDirection) {
        console.log("Wind layers missing from NWS grid data");
        return [];
    }
    if (windSpeed.uom !== SPEED_UOM || windGust.uom !== SPEED_UOM || windDirection.uom !== DIRECTION_UOM) {
        console.log(`Unexpected NWS wind units: ${windSpeed.uom}, ${windGust.uom}, ${windDirection.uom}`);
        return [];
    }

    try {
        const speeds = expandLayer(windSpeed);
        const gusts = expandLayer(windGust);
        const directions = expandLayer(windDirection);

        // The speed layer decides which hours we report. Map.get returns undefined for an hour a
        // layer doesn't cover; "?? null" turns that into null, our "no value" marker.
        return [...speeds].map(([time, speedKmh]) => ({
            time,
            speedMph: toMph(speedKmh),
            gustMph: toMph(gusts.get(time) ?? null),
            directionDeg: directions.get(time) ?? null,
        }));
    } catch (error) {
        // expandLayer throws if NWS sends a malformed validTime.
        console.log("Failed to parse NWS wind layers", error);
        return [];
    }
}

// km/h to whole mph. NWS speeds are whole knots converted to km/h, so decimals would be false precision.
function toMph(kmh: number | null): number | null {
    return kmh === null ? null : Math.round(kmh / KMH_PER_MPH);
}
