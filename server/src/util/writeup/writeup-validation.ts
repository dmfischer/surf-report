import { Rating } from "../../model/hour-rating";
import { DayBlock, WeekSummary } from "../../model/week-summary";
import { Writeup, WriteupDay } from "../../model/writeup";
import { MAX_BEST_BETS_PER_DAY } from "./writeup-prompt";

export interface ValidatedWriteup {
    // The write-up with everything that didn't check out removed.
    writeup: Writeup;
    // What was removed and why, for the log. Empty when the model followed the data exactly.
    issues: string[];
}

// Checks the model's write-up against the summary it was generated from: the model may only point
// readers at what our own ratings support. Removes what doesn't check out, rather than rejecting the
// whole write-up over one bad best bet:
// - a day whose date isn't in the summary, or that repeats an earlier day, is dropped;
// - a best bet is dropped unless its spot is one of ours and that spot's block on that date is rated
//   fair or good (so a made-up spot, a typo'd id, or a poor block can't be recommended);
// - repeated best bets are dropped, and each day keeps at most MAX_BEST_BETS_PER_DAY (the first ones,
//   since the model lists them best first).
// The prose can't be checked this way; that's what the system prompt is for.
export function validateWriteup(writeup: Writeup, summary: WeekSummary): ValidatedWriteup {
    const issues: string[] = [];
    const ratings = indexRatings(summary);
    const summaryDates = new Set(summary.spots.flatMap((spot) => spot.days.map((day) => day.date)));

    const seenDates = new Set<string>();
    const days: WriteupDay[] = [];
    for (const day of writeup.days) {
        if (!summaryDates.has(day.date)) {
            issues.push(`Dropped day ${day.date}: not in the summary`);
            continue;
        }
        if (seenDates.has(day.date)) {
            issues.push(`Dropped repeated day ${day.date}`);
            continue;
        }
        seenDates.add(day.date);
        days.push({ ...day, bestBets: validateBestBets(day, ratings, issues) });
    }

    // "YYYY-MM-DD" sorts correctly as text. The schema asks for date order; this makes sure of it.
    days.sort((a, b) => a.date.localeCompare(b.date));

    return { writeup: { ...writeup, days }, issues };
}

function validateBestBets(day: WriteupDay, ratings: Map<string, Rating>, issues: string[]): WriteupDay["bestBets"] {
    const kept: WriteupDay["bestBets"] = [];
    const seen = new Set<string>();
    for (const bet of day.bestBets) {
        const label = `${bet.spotId} ${bet.block} on ${day.date}`;
        const key = ratingKey(bet.spotId, day.date, bet.block);
        const rating = ratings.get(key);
        if (rating === undefined) {
            // Covers an unknown spot id and a spot/date/block the summary has no data for.
            issues.push(`Dropped best bet ${label}: not in the summary`);
        } else if (rating === "poor") {
            issues.push(`Dropped best bet ${label}: rated poor`);
        } else if (seen.has(key)) {
            issues.push(`Dropped repeated best bet ${label}`);
        } else if (kept.length >= MAX_BEST_BETS_PER_DAY) {
            issues.push(`Dropped best bet ${label}: more than ${MAX_BEST_BETS_PER_DAY} that day`);
        } else {
            seen.add(key);
            kept.push(bet);
        }
    }
    return kept;
}

// Every spot/date/block's rating, keyed "spotId|date|block", so each best bet is a single lookup.
function indexRatings(summary: WeekSummary): Map<string, Rating> {
    const ratings = new Map<string, Rating>();
    for (const spot of summary.spots) {
        for (const day of spot.days) {
            for (const block of day.blocks) {
                ratings.set(ratingKey(spot.id, day.date, block.block), block.rating);
            }
        }
    }
    return ratings;
}

function ratingKey(spotId: string, date: string, block: DayBlock): string {
    return `${spotId}|${date}|${block}`;
}
