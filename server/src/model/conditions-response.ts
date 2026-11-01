import { Station } from "./station";
import { TideLevel } from "./tide-level";

export interface ConditionsResponse {
    zipCode: string;
    status: "ok" | "unknown_zip" | "no_nearby_station";
    message: string | null;
    description: string;
    station: Station | null;
    stationDistanceMiles: number | null;
    tideLevels: TideLevel[];
}