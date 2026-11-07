import type { ConditionsResponse } from "../types/conditions";

export async function getConditions(zipCode: string): Promise<ConditionsResponse> {
    const response = await fetch(`/api/conditions/${zipCode}`);

    if (response.ok) {
        return (await response.json()) as ConditionsResponse;
    }

    throw new Error(`Conditions request failed: ${response.status}`);
}
