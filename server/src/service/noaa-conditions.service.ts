import { ConditionsResponse } from "../model/conditions-response";
import { Station } from "../model/station";
import { TidePrediction } from "../model/tide-prediction";
import { findStation } from "./noaa-stations.service";
import { getTidePrediction } from "./noaa-tides.service";

export async function getConditions(zipCode: string): Promise<ConditionsResponse> {
    const station: Station | null = findStation(zipCode);

    let tidePrediction: TidePrediction | null = null;
    if (station) {
        tidePrediction = await getTidePrediction(station);
    }

    return {
        zipCode: zipCode,
        description: "flat",
        station: station,
        tidePrediction: tidePrediction,
    }
}