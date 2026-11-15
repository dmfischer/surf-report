import { ConditionsResponse } from "../model/conditions-response";
import { DEFAULT_MAX_STATION_DISTANCE_MILES, findStation } from "./noaa-stations.service";
import { getTideLevels } from "./noaa-tides.service";
import { getGridpointData } from "./nws-gridpoints.service";
import { getWindForecast } from "./nws-wind.service";
import { findBuoy } from "./ndbc-buoys.service";
import { getLatestSwell } from "./ndbc-swell.service";
import { getSwellForecast } from "./open-meteo-swell.service";
import { TideLevel } from "../model/tide-level";

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
            buoy: null,
            buoyDistanceMiles: null,
            windForecast: [],
            swell: null,
            swellForecastLocation: null,
            swellForecast: [],
        }
    }

    // The nearest wave buoy, for swell. Wind deliberately stays at the zip code:
    // what matters for surf is the wind at the shore, and a buoy can be miles out at sea.
    const nearestBuoy = findBuoy(lookup.zipLocation);

    // NOAA (tides), NWS (wind), NDBC (measured swell) and Open-Meteo (swell forecast) are independent,
    // so start all the requests and wait for all of them, instead of one after another.
    const [tideLevels, gridData, swell, swellForecast] = await Promise.all([
        getTideLevels(lookup.station),
        getGridpointData(lookup.zipLocation),
        nearestBuoy ? getLatestSwell(nearestBuoy.buoy) : null,
        getSwellForecast(lookup.zipLocation),
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
        buoy: nearestBuoy?.buoy ?? null,
        buoyDistanceMiles: nearestBuoy ? Math.round(nearestBuoy.distanceMiles * 10) / 10 : null,
        windForecast: trimToTideHours(windForecast, tideLevels),
        swell: swell,
        swellForecastLocation: swellForecast?.location ?? null,
        swellForecast: trimToTideHours(swellForecast?.forecast ?? [], tideLevels),
    }
}

// Forecasts (wind from NWS, swell from Open-Meteo) start earlier and run longer than the tide chart;
// keep only the hours the chart shows, so everything shares one x-axis. Without tides, keep them all.
// Generic: <T extends { time: string }> means "a list of anything that has a time string", so the
// same function works for WindForecast[] and SwellForecast[], and returns the same type it was given.
function trimToTideHours<T extends { time: string }>(items: T[], tideLevels: TideLevel[]): T[] {
    const first = tideLevels[0];
    const last = tideLevels[tideLevels.length - 1];
    if (!first || !last) {
        return items;
    }

    // Compare as timestamps, not strings: tide times are "...T07:00:00Z", wind times "...T07:00:00.000Z".
    const start = Date.parse(first.time);
    const end = Date.parse(last.time);
    return items.filter((item) => {
        const time = Date.parse(item.time);
        return time >= start && time <= end;
    });
}