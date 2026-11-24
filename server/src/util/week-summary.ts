import { REGION } from "../data/region";
import { HourRating, Rating } from "../model/hour-rating";
import { Spot } from "../model/spot";
import { SpotConditionsResponse } from "../model/spot-conditions-response";
import { SwellForecast } from "../model/swell-forecast";
import { TideLevel } from "../model/tide-level";
import {
    BlockSummary,
    BuoyReadingSummary,
    DayBlock,
    SpotDaySummary,
    SpotSummary,
    TideStationSummary,
    TideTurn,
    WeekSummary,
} from "../model/week-summary";
import { WindForecast } from "../model/wind-forecast";
import {
    BIG_SWELL_GOOD_FROM_FT,
    BIG_SWELL_PERIOD_GOOD_FROM_S,
    OFFSHORE_WITHIN_DEG,
    ONSHORE_WITHIN_DEG,
    PERIOD_GOOD_FROM_S,
    PERIOD_POOR_BELOW_S,
    SWELL_GOOD_FROM_FT,
    SWELL_POOR_BELOW_FT,
    WIND_LIGHT_BELOW_MPH,
    WIND_ONSHORE_POOR_ABOVE_MPH,
    isInWindow,
    ratingRank,
    toCompass,
    windRelation,
} from "./rating";

// Parts of the local day, as [startHour, endHour) in local clock hours: an hour starting at 8:00 is
// morning, not dawn. Night hours (19:00-05:00) are dropped: nobody surfs them, and leaving them out
// keeps the prompt short. Fixed clock hours, not sunrise/sunset, so the blocks mean the same thing all
// year; in winter dawn and evening are partly dark.
export const DAY_BLOCKS: { block: DayBlock; startHour: number; endHour: number }[] = [
    { block: "dawn", startHour: 5, endHour: 8 },
    { block: "morning", startHour: 8, endHour: 12 },
    { block: "afternoon", startHour: 12, endHour: 16 },
    { block: "evening", startHour: 16, endHour: 19 },
];

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

// A local calendar date ("YYYY-MM-DD"), clock hour (0-23) and clock time ("HH:mm") for an instant.
interface LocalTime {
    date: string;
    hour: number;
    time: string;
}

type LocalClock = (ms: number) => LocalTime;

// Everything the LLM will see about the coming week, built from every spot's conditions. Pure: no
// fetching, and `now` is passed in so tests can fix it. Hours that ended before `now` are left out,
// so the summary is about what's still to come.
export function summarizeWeek(conditions: SpotConditionsResponse[], now: Date): WeekSummary {
    const clock = localClock(REGION.timeZone);
    const today = clock(now.getTime()).date;
    const spots = conditions.map((spotConditions) => summarizeSpot(spotConditions, now, clock));

    // "YYYY-MM-DD" strings sort in date order, so the largest is the latest.
    const dates = spots.flatMap((spot) => spot.days.map((day) => day.date));
    const forecastThrough = dates.reduce((latest, date) => (date > latest ? date : latest), today);

    return {
        region: REGION.name,
        timeZone: REGION.timeZone,
        generatedAt: now.toISOString(),
        today,
        forecastThrough,
        ratingRules: ratingRules(),
        notes: NOTES,
        tides: summarizeTides(conditions, now, clock),
        spots,
    };
}

// Built from rating.ts's constants, so the rules the model reads can't drift from the code.
export function ratingRules(): string[] {
    const blocks = DAY_BLOCKS.map(({ block, startHour, endHour }) => `${block} ${startHour}-${endHour}`).join(", ");
    return [
        "Each hour is rated good, fair or poor for swell and for wind; the hour gets the worse of the two. Tide isn't rated.",
        `Swell: the better of the primary and secondary swell counts. Poor if it comes from outside the spot's swell window, ` +
            `is under ${SWELL_POOR_BELOW_FT} ft or under ${PERIOD_POOR_BELOW_S} s. Good if at least ${SWELL_GOOD_FROM_FT} ft ` +
            `at ${PERIOD_GOOD_FROM_S} s or more, or at least ${BIG_SWELL_GOOD_FROM_FT} ft at ${BIG_SWELL_PERIOD_GOOD_FROM_S} s or more. Otherwise fair.`,
        `Wind: under ${WIND_LIGHT_BELOW_MPH} mph is good from any direction. Offshore (within ${OFFSHORE_WITHIN_DEG}° of ` +
            `straight offshore) is good. Onshore (within ${ONSHORE_WITHIN_DEG}° of straight onshore) is poor above ` +
            `${WIND_ONSHORE_POOR_ABOVE_MPH} mph, otherwise fair. Cross-shore is fair.`,
        `Day blocks (local hours, end excluded): ${blocks}. Night hours are left out. A block shows its best hour's ` +
            `rating, reasons, swell and wind; hoursAtRating of hours says how much of the block reaches that rating.`,
    ];
}

const NOTES = [
    "Swell heights are an open-water model forecast (Open-Meteo) near the coast, not surf face height.",
    "The buoy reading is a measurement, not a forecast; ageHours is how old it was when this summary was built.",
    "Directions are where the wind or swell comes from.",
    "Tide heights are feet above mean lower low water (MLLW); times are local.",
    "Hours that had already passed when this summary was built are left out.",
];

function summarizeSpot(conditions: SpotConditionsResponse, now: Date, clock: LocalClock): SpotSummary {
    const { spot } = conditions;
    return {
        id: spot.id,
        name: spot.name,
        breakType: spot.breakType,
        facing: `faces ${toCompass(spot.facingDeg)}`,
        swellWindow: `swell from ${toCompass(spot.swellWindowMinDeg)} to ${toCompass(spot.swellWindowMaxDeg)} can reach it`,
        // Only point at a station that has tides in the summary; a station whose tides failed is no use.
        tideStationId: conditions.station && conditions.tideLevels.length > 0 ? conditions.station.id : null,
        latestBuoyReading: summarizeBuoy(conditions, now),
        days: summarizeDays(conditions, now, clock),
    };
}

function summarizeBuoy(conditions: SpotConditionsResponse, now: Date): BuoyReadingSummary | null {
    const { swell, buoy, spot } = conditions;
    if (!swell) {
        return null;
    }
    return {
        buoyId: buoy?.id ?? spot.buoyId,
        buoyName: buoy?.name ?? spot.buoyId,
        ageHours: roundTo1((now.getTime() - Date.parse(swell.time)) / MS_PER_HOUR),
        waveHeightFt: swell.waveHeightFt === null ? null : roundTo1(swell.waveHeightFt),
        swellHeightFt: swell.swellHeightFt === null ? null : roundTo1(swell.swellHeightFt),
        swellPeriodS: swell.swellPeriodS === null ? null : Math.round(swell.swellPeriodS),
        swellDirection: swell.swellDirection,
    };
}

// Groups the spot's hourly ratings into local days and blocks. Blocks and days without data are left out.
function summarizeDays(conditions: SpotConditionsResponse, now: Date, clock: LocalClock): SpotDaySummary[] {
    const swellByHour = new Map(conditions.swellForecast.map((swell) => [hourKey(swell.time), swell]));
    const windByHour = new Map(conditions.windForecast.map((wind) => [hourKey(wind.time), wind]));

    // date -> block -> that block's hours. Maps keep insertion order, and ratings are in time order,
    // so days come out in date order.
    const days = new Map<string, Map<DayBlock, HourRating[]>>();
    for (const rating of conditions.ratings) {
        const start = Date.parse(rating.time);
        if (start + MS_PER_HOUR <= now.getTime()) {
            continue; // this hour is over
        }
        const local = clock(start);
        const block = blockForHour(local.hour);
        if (!block) {
            continue; // night
        }
        const blocks = days.get(local.date) ?? new Map<DayBlock, HourRating[]>();
        blocks.set(block, [...(blocks.get(block) ?? []), rating]);
        days.set(local.date, blocks);
    }

    return [...days].map(([date, blocks]) => ({
        date,
        // DAY_BLOCKS order, so a day always reads dawn -> evening.
        blocks: DAY_BLOCKS.filter(({ block }) => blocks.has(block)).map(({ block }) =>
            summarizeBlock(conditions.spot, block, blocks.get(block) ?? [], swellByHour, windByHour, clock),
        ),
    }));
}

// Which day block a local clock hour belongs to, or null for night hours.
export function blockForHour(hour: number): DayBlock | null {
    return DAY_BLOCKS.find(({ startHour, endHour }) => hour >= startHour && hour < endHour)?.block ?? null;
}

// Collapses a block's hours into one: the BEST hour's rating, and that hour's reasons, swell and wind.
// Why best, not worst or average: the question a surfer asks of a block is "is it worth going?", and
// a block is worth going if part of it works (you don't surf all four hours). Taking one real hour,
// rather than averaging, keeps the rating, reasons, swell and wind consistent with each other and with
// rating.ts. Ties go to the earliest hour. hoursAtRating tells the model how much of the block it holds for.
function summarizeBlock(
    spot: Spot,
    block: DayBlock,
    hours: HourRating[],
    swellByHour: Map<number, SwellForecast>,
    windByHour: Map<number, WindForecast>,
    clock: LocalClock,
): BlockSummary {
    const bestRating = bestOf(hours.map((hour) => hour.rating));
    const atBest = hours.filter((hour) => hour.rating === bestRating);
    // atBest always has at least one hour, since bestRating came from these hours.
    const chosen = atBest[0] as HourRating;
    const key = hourKey(chosen.time);

    return {
        block,
        rating: bestRating,
        hour: clock(Date.parse(chosen.time)).time,
        hoursAtRating: atBest.length,
        hours: hours.length,
        reasons: chosen.reasons,
        swell: summarizeSwell(spot, swellByHour.get(key)),
        wind: summarizeWind(spot, windByHour.get(key)),
    };
}

function summarizeSwell(spot: Spot, forecast: SwellForecast | undefined): BlockSummary["swell"] {
    const primary = forecast?.primarySwell;
    if (!primary) {
        return null;
    }
    const { directionDeg } = primary;
    return {
        heightFt: roundTo1(primary.heightFt),
        periodS: primary.periodS === null ? null : Math.round(primary.periodS),
        direction: directionDeg === null ? null : toCompass(directionDeg),
        inWindow: directionDeg === null ? null : isInWindow(directionDeg, spot.swellWindowMinDeg, spot.swellWindowMaxDeg),
    };
}

function summarizeWind(spot: Spot, wind: WindForecast | undefined): BlockSummary["wind"] {
    if (!wind || (wind.speedMph === null && wind.directionDeg === null)) {
        return null;
    }
    const { directionDeg } = wind;
    return {
        speedMph: wind.speedMph === null ? null : Math.round(wind.speedMph),
        gustMph: wind.gustMph === null ? null : Math.round(wind.gustMph),
        direction: directionDeg === null ? null : toCompass(directionDeg),
        relation: directionDeg === null ? null : windRelation(spot, directionDeg),
    };
}

// One summary per distinct tide station (spots near each other share one), with each local day's
// highs and lows that haven't happened yet.
function summarizeTides(conditions: SpotConditionsResponse[], now: Date, clock: LocalClock): TideStationSummary[] {
    const stations = new Map<string, TideStationSummary>();
    for (const { station, tideLevels } of conditions) {
        if (!station || tideLevels.length === 0 || stations.has(station.id)) {
            continue;
        }

        const days = new Map<string, { date: string; highs: TideTurn[]; lows: TideTurn[] }>();
        for (const turn of findTideTurns(tideLevels)) {
            if (turn.ms < now.getTime()) {
                continue;
            }
            const local = clock(turn.ms);
            const day = days.get(local.date) ?? { date: local.date, highs: [], lows: [] };
            const summary = { time: local.time, heightFt: roundTo1(turn.heightFt) };
            (turn.kind === "high" ? day.highs : day.lows).push(summary);
            days.set(local.date, day);
        }

        stations.set(station.id, { stationId: station.id, stationName: station.name, days: [...days.values()] });
    }
    return [...stations.values()];
}

export interface TideTurnInstant {
    kind: "high" | "low";
    ms: number; // UTC epoch milliseconds
    heightFt: number;
}

// Highs and lows in hourly tide heights: points higher (or lower) than both neighbours. Hourly data
// only gives the turn to the nearest hour, so we fit a parabola through the turning point and its two
// neighbours and take its vertex, which is usually within a few minutes and a few hundredths of a foot
// of NOAA's own high/low predictions. The first and last points can't be turns (one neighbour missing).
export function findTideTurns(levels: TideLevel[]): TideTurnInstant[] {
    const turns: TideTurnInstant[] = [];
    for (let i = 1; i < levels.length - 1; i++) {
        const before = levels[i - 1] as TideLevel;
        const at = levels[i] as TideLevel;
        const after = levels[i + 1] as TideLevel;
        // > on one side and >= on the other, so a flat top of two equal hours counts once, not twice or never.
        const isHigh = at.height > before.height && at.height >= after.height;
        const isLow = at.height < before.height && at.height <= after.height;
        if (!isHigh && !isLow) {
            continue;
        }
        const vertex = parabolaVertex(before.height, at.height, after.height);
        const halfSpanMs = (Date.parse(after.time) - Date.parse(before.time)) / 2;
        turns.push({
            kind: isHigh ? "high" : "low",
            ms: Date.parse(at.time) + vertex.offset * halfSpanMs,
            heightFt: vertex.height,
        });
    }
    return turns;
}

// The vertex of the parabola through (-1, a), (0, b), (1, c). offset is where it is, in steps from
// the middle point (between -0.5 and 0.5 for a turning point), and height its value there.
export function parabolaVertex(a: number, b: number, c: number): { offset: number; height: number } {
    const curvature = a - 2 * b + c;
    if (curvature === 0) {
        return { offset: 0, height: b }; // three points in a line: no better guess than the middle one
    }
    const offset = (a - c) / (2 * curvature);
    return { offset, height: b - ((a - c) * offset) / 4 };
}

// One formatter for the whole summary (creating Intl formatters is relatively slow). en-CA formats
// dates as YYYY-MM-DD; h23 gives 0-23 hours (not 24 for midnight).
function localClock(timeZone: string): LocalClock {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    });
    return (ms) => {
        // Round to the minute first: a fitted tide time of 06:59:40 should read 07:00, not 06:59.
        const parts = formatter.formatToParts(new Date(Math.round(ms / MS_PER_MINUTE) * MS_PER_MINUTE));
        const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
        return {
            date: `${part("year")}-${part("month")}-${part("day")}`,
            hour: Number(part("hour")),
            time: `${part("hour")}:${part("minute")}`,
        };
    };
}

function bestOf(ratings: Rating[]): Rating {
    return ratings.reduce((a, b) => (ratingRank(b) > ratingRank(a) ? b : a));
}

function hourKey(time: string): number {
    return Math.floor(Date.parse(time) / MS_PER_HOUR);
}

function roundTo1(value: number): number {
    return Math.round(value * 10) / 10;
}
