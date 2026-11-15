import { TideLevel } from "../model/tide-level";

// Forecasts (wind from NWS, swell from Open-Meteo) start earlier and run longer than the tide chart;
// keep only the hours the chart shows, so everything shares one x-axis. Without tides, keep them all.
// Generic: <T extends { time: string }> means "a list of anything that has a time string", so the
// same function works for WindForecast[] and SwellForecast[], and returns the same type it was given.
export function trimToTideHours<T extends { time: string }>(items: T[], tideLevels: TideLevel[]): T[] {
    const first = tideLevels[0];
    const last = tideLevels[tideLevels.length - 1];
    if (!first || !last) {
        return items;
    }

    // Compare as timestamps, not strings: tide times are "...T07:00:00Z", wind times "...T07:00:00.000Z".
    const start = Date.parse(first.time);
    const end = Date.parse(last.time);
    return items.filter((item) => {
        const time = Date.parse(item.time);
        return time >= start && time <= end;
    });
}
