import { Spot } from "../model/spot";

// Hand-curated surf spots. A .ts file rather than .json so the compiler checks every entry against Spot.
//
// Sources (checked 2026-11-16):
// - Locations: OpenStreetMap named beaches; Point Judith is the east side of the point, just NE of the
//   lighthouse (where it's surfed, riding toward the northwest); Matunuck from the developer.
// - facingDeg: averaged seaward normal of the OpenStreetMap coastline within ~300-700 m of each spot
//   (OSM coastlines have land on the left and water on the right, so the coast's direction + 90° points
//   out to sea). For Point Judith only the east-side coast within 300 m of the lighthouse.
// - swellWindowMin/MaxDeg: ESTIMATES (not measured), roughly facing ± 60-70°, adjusted for what blocks
//   or wraps around each spot. Point Judith's (south swell wrapping onto the east side) needs revisiting.
// - buoyId: 44097 Block Island is the open-ocean buoy south of all of these. The nearer 44085 is in
//   Buzzards Bay and sheltered from the south swell that reaches these breaks.
export const SPOTS: Spot[] = [
    {
        id: "narragansett-town-beach",
        name: "Narragansett Town Beach",
        lat: 41.4364,
        lng: -71.4514,
        breakType: "beach",
        facingDeg: 135,
        swellWindowMinDeg: 90,
        swellWindowMaxDeg: 200,
        buoyId: "44097",
    },
    {
        // Rock reef at State Pier 5 / Monahan's Clam Shack (190 Ocean Rd, OSM), just south of the Town Beach.
        // facingDeg measured from OSM coastline within 300-700 m (74-82°). Window is an estimate.
        id: "monahans-dock",
        name: "Monahan's Dock",
        lat: 41.4222,
        lng: -71.455,
        breakType: "reef",
        facingDeg: 80,
        swellWindowMinDeg: 80,
        swellWindowMaxDeg: 200,
        buoyId: "44097",
    },
    {
        id: "scarborough",
        name: "Scarborough State Beach",
        lat: 41.3877,
        lng: -71.4722,
        breakType: "beach",
        facingDeg: 120,
        swellWindowMinDeg: 80,
        swellWindowMaxDeg: 190,
        buoyId: "44097",
    },
    {
        id: "point-judith",
        name: "Point Judith",
        lat: 41.3619,
        lng: -71.4807,
        breakType: "point",
        facingDeg: 100,
        swellWindowMinDeg: 110,
        swellWindowMaxDeg: 230,
        buoyId: "44097",
    },
    {
        id: "matunuck",
        name: "Matunuck",
        lat: 41.3747,
        lng: -71.5511,
        breakType: "beach",
        facingDeg: 175,
        swellWindowMinDeg: 120,
        swellWindowMaxDeg: 240,
        buoyId: "44097",
    },
];
