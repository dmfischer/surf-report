import { Spot } from "../model/spot";

// Hand-curated surf spots. A .ts file rather than .json so the compiler checks every entry against Spot.
//
// Sources (checked 2026-11-16):
// - Locations: OpenStreetMap named beaches; Point Judith is the east side of the point, just NE of the
//   lighthouse (where it's surfed, riding toward the northwest); Matunuck from the developer.
// - facingDeg: averaged seaward normal of the OpenStreetMap coastline within ~300-700 m of each spot
//   (OSM coastlines have land on the left and water on the right, so the coast's direction + 90° points
//   out to sea). For Point Judith only the east-side coast within 300 m of the lighthouse.
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
        buoyId: "44097",
    },
    {
        id: "scarborough",
        name: "Scarborough State Beach",
        lat: 41.3877,
        lng: -71.4722,
        breakType: "beach",
        facingDeg: 120,
        buoyId: "44097",
    },
    {
        id: "point-judith",
        name: "Point Judith",
        lat: 41.3619,
        lng: -71.4807,
        breakType: "point",
        facingDeg: 100,
        buoyId: "44097",
    },
    {
        id: "matunuck",
        name: "Matunuck",
        lat: 41.3747,
        lng: -71.5511,
        breakType: "beach",
        facingDeg: 175,
        buoyId: "44097",
    },
];
