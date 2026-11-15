export interface WindForecast {
    // ISO 8601 instant in UTC, e.g. "2026-11-15T02:00:00.000Z"; same convention as TideLevel.time.
    time: string;
    // Speeds are converted from NWS's km/h. null when NWS has no value for this hour.
    speedMph: number | null;
    gustMph: number | null;
    // Direction the wind blows FROM, in degrees: 0 = north, 90 = east.
    directionDeg: number | null;
}
