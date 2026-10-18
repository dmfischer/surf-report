import { ConditionsResponse } from "../model/conditions-response";

export function getConditions(zipCode: string) {
    return new ConditionsResponse(zipCode, "flat");
}