import zipcodes from "zipcodes";
import { SPOTS } from "../data/spots";
import { Spot } from "../model/spot";
import { SpotsResponse } from "../model/spots-response";
import { haversineDistanceMiles } from "../util/haversine";

export const DEFAULT_MAX_SPOT_DISTANCE_MILES = 25;

// The spots within maxDistanceMiles of a zip code's center, nearest first.
// `spots` is a parameter (defaulting to the real list) so tests can pass their own.
export function findSpotsNear(
    zipCode: string,
    maxDistanceMiles: number = DEFAULT_MAX_SPOT_DISTANCE_MILES,
    spots: Spot[] = SPOTS,
): SpotsResponse {
    const zip = zipcodes.lookup(zipCode);
    if (!zip) {
        return { zipCode, status: "unknown_zip", message: `Unknown zip code ${zipCode}`, zipLocation: null, spots: [] };
    }

    const zipLocation = { lat: zip.latitude, lng: zip.longitude };
    const nearby = spots
        .map((spot) => ({
            ...spot,
            distanceMiles: Math.round(haversineDistanceMiles(zipLocation.lat, zipLocation.lng, spot.lat, spot.lng) * 10) / 10,
        }))
        .filter((spot) => spot.distanceMiles <= maxDistanceMiles)
        .sort((a, b) => a.distanceMiles - b.distanceMiles);

    return { zipCode, status: "ok", message: null, zipLocation, spots: nearby };
}

// Looks a spot up by id, for the per-spot conditions endpoint (next step).
export function getSpot(id: string, spots: Spot[] = SPOTS): Spot | undefined {
    return spots.find((spot) => spot.id === id);
}
