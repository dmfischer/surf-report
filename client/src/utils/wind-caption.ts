import type { WindForecast } from "../types/conditions";
import { toCompass } from "./direction";

// "Wind now: 8 mph from W (280°), gusts 17 mph", or a "no forecast" message.
// isCurrent: true when `wind` is the current hour rather than a time hovered on the tide chart.
export function describeWind(wind: WindForecast | undefined, isCurrent: boolean, timeZone: string): string {
    if (!wind || wind.speedMph === null) {
        return "No wind forecast for this hour";
    }

    const timeFormat = new Intl.DateTimeFormat("en-US", {
        timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    const when = isCurrent ? "now" : timeFormat.format(Date.parse(wind.time));
    const direction = wind.directionDeg;
    const from = direction === null ? "" : ` from ${toCompass(direction)} (${direction}°)`;
    const gusts = wind.gustMph === null ? "" : `, gusts ${wind.gustMph} mph`;
    return `Wind ${when}: ${wind.speedMph} mph${from}${gusts}`;
}
