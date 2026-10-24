import { Station } from "./station";
import { TideLevel } from "./tide-level";

export interface ConditionsResponse {
    zipCode: string;
    description: string;
    station: Station | null;
    tideLevels: TideLevel[];
}