import { LatLng } from "./lat-lng";
import { Spot } from "./spot";

export interface SpotNearby extends Spot {
    // Straight-line distance from the zip code's center, rounded to 1 decimal.
    distanceMiles: number;
}

// GET /api/spots?zip=02882
export interface SpotsResponse {
    zipCode: string;
    status: "ok" | "unknown_zip";
    message: string | null; // human-readable; null when ok
    zipLocation: LatLng | null; // null unless status is "ok"
    // Nearest first. Empty when no spots are defined near this zip yet: clients then fall back to
    // the zip-based GET /api/conditions/:zipCode.
    spots: SpotNearby[];
}
