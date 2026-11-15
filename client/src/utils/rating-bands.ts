import type { HourRating, Rating } from "../types/spots";

const MS_PER_HOUR = 60 * 60 * 1000;

// A stretch of consecutive hours with the same rating, as timestamps (ms since 1970).
export interface RatingBand {
    start: number;
    end: number; // exclusive: the start of the first hour after the band
    rating: Rating;
}

// Merges hourly ratings into bands, so the chart draws a few wide rectangles instead of 169 thin ones.
// Expects ratings in time order, one per hour (as the API sends them). A gap in the hours ends a band.
export function toRatingBands(ratings: HourRating[]): RatingBand[] {
    const bands: RatingBand[] = [];
    for (const hour of ratings) {
        const start = Date.parse(hour.time);
        const last = bands[bands.length - 1];
        if (last && last.rating === hour.rating && last.end === start) {
            last.end = start + MS_PER_HOUR; // extend the current band
        } else {
            bands.push({ start, end: start + MS_PER_HOUR, rating: hour.rating });
        }
    }
    return bands;
}
