import { Rating } from "./hour-rating";

// The data the LLM sees: a compact summary of the coming week for every spot in a region, built by
// util/week-summary.summarizeWeek from each spot's SpotConditionsResponse. Our code does the judging
// (ratings, offshore/onshore, tide times); the model only explains and compares.
//
// All dates are local calendar dates in timeZone ("YYYY-MM-DD"); all clock times are local "HH:mm".

// Part of a local day. Hour boundaries are defined in util/week-summary.ts.
export type DayBlock = "dawn" | "morning" | "afternoon" | "evening";

export interface WeekSummary {
    region: string;
    timeZone: string;
    // ISO 8601 UTC instant the summary was built.
    generatedAt: string;
    today: string;
    // Last local date with forecast data.
    forecastThrough: string;
    // Short plain-language version of util/rating.ts's rules, for the model's context.
    ratingRules: string[];
    // What the numbers mean (forecast vs measured, tide datum, ...), so the model doesn't guess.
    notes: string[];
    // One entry per tide station; spots that share a station refer to it by id.
    tides: TideStationSummary[];
    spots: SpotSummary[];
}

export interface TideStationSummary {
    stationId: string;
    stationName: string;
    days: { date: string; highs: TideTurn[]; lows: TideTurn[] }[];
}

export interface TideTurn {
    time: string; // local "HH:mm"
    heightFt: number;
}

export interface SpotSummary {
    id: string;
    name: string;
    breakType: "beach" | "point" | "reef";
    facing: string; // e.g. "faces SE"
    swellWindow: string; // e.g. "swell from E to SSW can reach it"
    tideStationId: string | null;
    latestBuoyReading: BuoyReadingSummary | null;
    days: SpotDaySummary[];
}

export interface BuoyReadingSummary {
    buoyId: string;
    buoyName: string;
    ageHours: number;
    waveHeightFt: number | null;
    swellHeightFt: number | null;
    swellPeriodS: number | null;
    swellDirection: string | null;
}

export interface SpotDaySummary {
    date: string;
    blocks: BlockSummary[];
}

// A block is summarized by its best hour (see util/week-summary.ts): rating, reasons, swell and wind
// all describe that one hour, so they always agree with each other.
export interface BlockSummary {
    block: DayBlock;
    rating: Rating;
    // Local "HH:mm" of the hour shown (the earliest hour with the block's best rating).
    hour: string;
    // How many of the block's forecast hours have that rating, out of how many: tells "all morning"
    // (4 of 4) apart from "one good hour" (1 of 4).
    hoursAtRating: number;
    hours: number;
    reasons: string[];
    // Primary swell. inWindow is null when the direction is unknown.
    swell: { heightFt: number; periodS: number | null; direction: string | null; inWindow: boolean | null } | null;
    // relation is null when the direction is unknown.
    wind: { speedMph: number | null; gustMph: number | null; direction: string | null; relation: WindRelation | null } | null;
}

export type WindRelation = "offshore" | "cross-shore" | "onshore";
