import { ConditionsResponse } from "../model/conditions-response";
import { Station } from "../model/station";
import { TideLevel } from "../model/tide-level";
import { findStation } from "./noaa-stations.service";
import { getTideLevels } from "./noaa-tides.service";

export async function getConditions(zipCode: string): Promise<ConditionsResponse> {
    const station: Station | null = findStation(zipCode);

    let tideLevels: TideLevel[] = [];
    if (station) {
        tideLevels = await getTideLevels(station);
    }

    return {
        zipCode: zipCode,
        description: "flat",
        station: station,
        tideLevels: tideLevels,
    }
}