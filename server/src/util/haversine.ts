const EARTH_RADIUS_MILES = 3958.8;

function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

// Great-circle distance between two lat/lng points, in miles.
// The haversine formula accounts for Earth's curvature, unlike a flat x/y distance.
export function haversineDistanceMiles(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
): number {
    const lat1Rad = toRadians(lat1);
    const lat2Rad = toRadians(lat2);
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_MILES * c;
}
