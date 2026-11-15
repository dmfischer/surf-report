import { ConditionsResponse } from "../model/conditions-response";
import { DEFAULT_MAX_STATION_DISTANCE_MILES, findStation } from "./noaa-stations.service";
import { getTideLevels } from "./noaa-tides.service";
import { getGridpointData } from "./nws-gridpoints.service";
import { getWindForecast } from "./nws-wind.service";
import { TideLevel } from "../model/tide-level";
import { WindForecast } from "../model/wind-forecast";

export async function getConditions(zipCode: string): Promise<ConditionsResponse> {
    const lookup = findStation(zipCode);

    if (lookup.status !== "ok") {
        const message = lookup.status === "unknown_zip"
            ? `Unknown zip code ${zipCode}`
            : `No tide station within ${DEFAULT_MAX_STATION_DISTANCE_MILES} miles of ${zipCode}`;

        return {
            zipCode: zipCode,
            status: lookup.status,
            message: message,
            description: "flat",
            zipLocation: null,
            station: null,
            stationDistanceMiles: null,
            tideLevels: [],
            windForecast: [],
        }
    }

    // NOAA (tides) and NWS (wind) are independent, so start both requests and wait for both,
    // instead of waiting for one to finish before starting the other.
    const [tideLevels, gridData] = await Promise.all([
        getTideLevels(lookup.station),
        getGridpointData(lookup.zipLocation),
    ]);
    const windForecast = gridData ? getWindForecast(gridData) : [];

    return {
        zipCode: zipCode,
        status: "ok",
        message: null,
        description: "flat",
        zipLocation: lookup.zipLocation,
        station: lookup.station,
        stationDistanceMiles: Math.round(lookup.distanceMiles * 10) / 10,
        tideLevels: tideLevels,
        windForecast: trimToTideHours(windForecast, tideLevels),
    }
}

// NWS forecasts start a few hours in the past and run about 8 days; keep only the hours the
// tide chart shows, so both charts share an x-axis. Without tides, keep all the wind hours.
function trimToTideHours(windForecast: WindForecast[], tideLevels: TideLevel[]): WindForecast[] {
    const first = tideLevels[0];
    const last = tideLevels[tideLevels.length - 1];
    if (!first || !last) {
        return windForecast;
    }

    // Compare as timestamps, not strings: tide times are "...T07:00:00Z", wind times "...T07:00:00.000Z".
    const start = Date.parse(first.time);
    const end = Date.parse(last.time);
    return windForecast.filter((wind) => {
        const time = Date.parse(wind.time);
        return time >= start && time <= end;
    });
}