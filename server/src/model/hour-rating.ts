// How surfable a spot is likely to be in one hour. Shown as green / yellow / red.
export type Rating = "good" | "fair" | "poor";

export interface HourRating {
    // ISO 8601 instant in UTC (the swell forecast's hour).
    time: string;
    // The worst of the factors below: one bad factor (e.g. onshore wind) spoils an otherwise good hour.
    rating: Rating;
    swellRating: Rating;
    // null when there's no wind forecast for this hour; the rating is then based on swell alone.
    windRating: Rating | null;
    // Human-readable explanations, e.g. "Swell 3.3 ft @ 11 s from S (in window)", "Wind 8 mph from NW (offshore)".
    reasons: string[];
}
