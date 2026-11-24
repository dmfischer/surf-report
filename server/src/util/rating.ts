import { HourRating, Rating } from "../model/hour-rating";
import { Spot } from "../model/spot";
import { SwellForecast, WaveComponent } from "../model/swell-forecast";
import { WindRelation } from "../model/week-summary";
import { WindForecast } from "../model/wind-forecast";

// Thresholds for version 1: a starting point to tune against days you know.
// Exported so util/week-summary.ts can describe the rules to the LLM from the same numbers.
export const SWELL_POOR_BELOW_FT = 1.5;
export const SWELL_GOOD_FROM_FT = 3;
export const PERIOD_POOR_BELOW_S = 6;
export const PERIOD_GOOD_FROM_S = 9;
// Size makes up for period: a big, mid-period swell (e.g. 7 ft @ 8 s after a storm) is good too.
// Tuned 2026-11-23, when Monahan's Dock and Town Beach were good on ~7 ft @ 8 s SSE (Open-Meteo)
// and the 9 s rule alone rated them fair.
export const BIG_SWELL_GOOD_FROM_FT = 5;
export const BIG_SWELL_PERIOD_GOOD_FROM_S = 7;
export const WIND_LIGHT_BELOW_MPH = 6; // any direction is fine when it's this light
export const WIND_ONSHORE_POOR_ABOVE_MPH = 12;
// Wind within 45° of straight offshore counts as offshore, within 45° of straight onshore as onshore,
// anything in between as cross-shore.
export const OFFSHORE_WITHIN_DEG = 45;
export const ONSHORE_WITHIN_DEG = 45;

const RATING_ORDER: Rating[] = ["poor", "fair", "good"];

const MS_PER_HOUR = 60 * 60 * 1000;

const COMPASS_POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

// One rating per swell-forecast hour, using the wind forecast for the same hour when there is one.
export function rateHours(spot: Spot, swellForecast: SwellForecast[], windForecast: WindForecast[]): HourRating[] {
    // Index wind by hour (as a number), so each lookup is direct rather than a search.
    const windByHour = new Map(windForecast.map((wind) => [hourKey(wind.time), wind]));
    return swellForecast.map((swell) => rateHour(spot, swell, windByHour.get(hourKey(swell.time))));
}

export function rateHour(spot: Spot, swell: SwellForecast, wind: WindForecast | undefined): HourRating {
    const swellResult = rateSwell(spot, swell);
    const windResult = wind ? rateWind(spot, wind) : null;

    const ratings = windResult ? [swellResult.rating, windResult.rating] : [swellResult.rating];
    return {
        time: swell.time,
        rating: worst(ratings),
        swellRating: swellResult.rating,
        windRating: windResult?.rating ?? null,
        reasons: windResult ? [swellResult.reason, windResult.reason] : [swellResult.reason, "No wind forecast"],
    };
}

// Rates the primary and secondary swell and keeps the better one: a small in-window swell can matter
// more than a bigger one the spot can't see.
function rateSwell(spot: Spot, forecast: SwellForecast): { rating: Rating; reason: string } {
    const components = [forecast.primarySwell, forecast.secondarySwell].filter(
        (component): component is WaveComponent => component !== null,
    );
    if (components.length === 0) {
        return { rating: "poor", reason: "No swell" };
    }

    const rated = components.map((component) => rateSwellComponent(spot, component));
    return rated.reduce((best, next) => (ratingRank(next.rating) > ratingRank(best.rating) ? next : best));
}

function rateSwellComponent(spot: Spot, swell: WaveComponent): { rating: Rating; reason: string } {
    const period = swell.periodS === null ? "" : ` @ ${Math.round(swell.periodS)} s`;
    const from = swell.directionDeg === null ? "" : ` from ${toCompass(swell.directionDeg)}`;
    const description = `Swell ${swell.heightFt} ft${period}${from}`;

    if (swell.directionDeg !== null && !isInWindow(swell.directionDeg, spot.swellWindowMinDeg, spot.swellWindowMaxDeg)) {
        return { rating: "poor", reason: `${description} (can't reach this spot)` };
    }
    const periodS = swell.periodS ?? 0;
    if (swell.heightFt < SWELL_POOR_BELOW_FT || periodS < PERIOD_POOR_BELOW_S) {
        return { rating: "poor", reason: `${description} (too small or short)` };
    }
    if (swell.heightFt >= BIG_SWELL_GOOD_FROM_FT && periodS >= BIG_SWELL_PERIOD_GOOD_FROM_S) {
        return { rating: "good", reason: `${description} (big, in window)` };
    }
    if (swell.heightFt < SWELL_GOOD_FROM_FT || periodS < PERIOD_GOOD_FROM_S) {
        return { rating: "fair", reason: `${description} (small or short period)` };
    }
    return { rating: "good", reason: `${description} (in window)` };
}

function rateWind(spot: Spot, wind: WindForecast): { rating: Rating; reason: string } | null {
    if (wind.speedMph === null) {
        return null;
    }
    const from = wind.directionDeg === null ? "" : ` from ${toCompass(wind.directionDeg)}`;
    const description = `Wind ${wind.speedMph} mph${from}`;

    if (wind.speedMph < WIND_LIGHT_BELOW_MPH) {
        return { rating: "good", reason: `${description} (light)` };
    }
    if (wind.directionDeg === null) {
        return { rating: "fair", reason: `${description} (direction unknown)` };
    }

    const relation = windRelation(spot, wind.directionDeg);
    if (relation === "offshore") {
        return { rating: "good", reason: `${description} (offshore)` };
    }
    if (relation === "onshore") {
        return wind.speedMph > WIND_ONSHORE_POOR_ABOVE_MPH
            ? { rating: "poor", reason: `${description} (strong onshore)` }
            : { rating: "fair", reason: `${description} (onshore)` };
    }
    return { rating: "fair", reason: `${description} (cross-shore)` };
}

// Offshore wind blows from the land out to sea, i.e. FROM the direction opposite the one the break
// faces: a break facing 135° (SE) has offshore wind from 315° (NW). Onshore is the reverse, and
// anything in between is cross-shore. Speed isn't considered here; light wind is rated separately.
export function windRelation(spot: Spot, directionDeg: number): WindRelation {
    const offshoreFromDeg = (spot.facingDeg + 180) % 360;
    const offOffshore = angleBetween(directionDeg, offshoreFromDeg);
    if (offOffshore <= OFFSHORE_WITHIN_DEG) {
        return "offshore";
    }
    if (offOffshore >= 180 - ONSHORE_WITHIN_DEG) {
        return "onshore";
    }
    return "cross-shore";
}

// The smallest angle between two directions, 0–180. E.g. 350° and 10° are 20° apart.
export function angleBetween(a: number, b: number): number {
    const difference = Math.abs(a - b) % 360;
    return difference > 180 ? 360 - difference : difference;
}

// Whether `direction` lies on the clockwise arc from min to max (which may cross north, e.g. 300 to 30).
export function isInWindow(direction: number, min: number, max: number): boolean {
    const d = ((direction % 360) + 360) % 360;
    return min <= max ? d >= min && d <= max : d >= min || d <= max;
}

function worst(ratings: Rating[]): Rating {
    return ratings.reduce((a, b) => (ratingRank(b) < ratingRank(a) ? b : a));
}

// 0 for poor, 1 fair, 2 good, so ratings can be compared with < and >.
export function ratingRank(rating: Rating): number {
    return RATING_ORDER.indexOf(rating);
}

function hourKey(time: string): number {
    return Math.floor(Date.parse(time) / MS_PER_HOUR);
}

// 16-point compass name for a direction in degrees, e.g. 135 -> "SE".
export function toCompass(degrees: number): string {
    return COMPASS_POINTS[Math.round(degrees / 22.5) % 16] ?? "";
}
