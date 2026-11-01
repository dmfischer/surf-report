import { ConditionsResponse } from "../model/conditions-response";
import { DEFAULT_MAX_STATION_DISTANCE_MILES, findStation } from "./noaa-stations.service";
import { getTideLevels } from "./noaa-tides.service";

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
            station: null,
            stationDistanceMiles: null,
            tideLevels: [],
        }
    }

    return {
        zipCode: zipCode,
        status: "ok",
        message: null,
        description: "flat",
        station: lookup.station,
        stationDistanceMiles: Math.round(lookup.distanceMiles * 10) / 10,
        tideLevels: await getTideLevels(lookup.station),
    }
}