// A surf break: a fixed piece of coastline with its own geometry. Hand-curated in data/spots.ts.
export interface Spot {
    id: string; // URL-safe, e.g. "narragansett-town-beach"
    name: string;
    lat: number;
    lng: number;
    breakType: "beach" | "point" | "reef";
    // Direction the break faces, out to sea, in degrees (0 = north, 90 = east). Decides whether
    // wind is offshore or onshore, and roughly which swell directions can reach the spot.
    facingDeg: number;
    // NDBC buoy that best represents this spot's swell. Not always the nearest: a nearer buoy can be
    // sheltered from the swell that reaches the spot (e.g. Buzzards Bay vs Block Island for RI).
    buoyId: string;
}
