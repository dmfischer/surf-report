import { ConditionsResponse } from "../model/conditions-response";

export async function getConditions(zipCode: string) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    return new ConditionsResponse(zipCode, "flat");
}