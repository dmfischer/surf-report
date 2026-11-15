import type { SpotConditionsResponse, SpotsResponse } from "../types/spots";

export async function getSpots(zipCode: string): Promise<SpotsResponse> {
    // encodeURIComponent: the zip goes into a query string, so escape anything unexpected the user typed.
    const response = await fetch(`/api/spots?zip=${encodeURIComponent(zipCode)}`);

    if (response.ok) {
        return (await response.json()) as SpotsResponse;
    }

    throw new Error(`Spots request failed: ${response.status}`);
}

export async function getSpotConditions(spotId: string): Promise<SpotConditionsResponse> {
    const response = await fetch(`/api/spots/${encodeURIComponent(spotId)}/conditions`);

    if (response.ok) {
        return (await response.json()) as SpotConditionsResponse;
    }

    throw new Error(`Spot conditions request failed: ${response.status}`);
}
