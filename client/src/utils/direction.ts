// Small pure helpers for compass directions, in degrees (0 = north, 90 = east).

const COMPASS_POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

// 280 -> "W". Each of the 16 points covers 22.5°, centered on its direction.
export function toCompass(degrees: number): string {
    return COMPASS_POINTS[Math.round(degrees / 22.5) % 16];
}

// The smallest turn from `from` to `to`, between -180 and 180. E.g. 350 -> 10 is +20, not -340.
// `from` can be any number (it keeps growing past 360); `to` is 0–359.
export function shortestTurn(from: number, to: number): number {
    return ((((to - from) % 360) + 540) % 360) - 180;
}
