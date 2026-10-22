import { Station } from "./station";
import { TidePrediction } from "./tide-prediction";

export interface ConditionsResponse {
    zipCode: string;
    description: string;
    station: Station | null;
    tidePrediction: TidePrediction | null;
}