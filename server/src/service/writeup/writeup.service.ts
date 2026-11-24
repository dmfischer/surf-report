import { DayBlock, WeekSummary } from "../../model/week-summary";
import { Writeup, WriteupDay } from "../../model/writeup";
// Shared with the prompt (and later the validation), so a great day doesn't turn into a list of every block.
import { MAX_BEST_BETS_PER_DAY } from "../../util/writeup/writeup-prompt";

// Blocks in the order they happen in a day, for sorting best bets.
const BLOCK_ORDER: DayBlock[] = ["dawn", "morning", "afternoon", "evening"];

// Returns null on failure (logged, not thrown), like the other services, so the scheduler can keep
// the previous write-up.
export async function generateWriteup(summary: WeekSummary): Promise<Writeup | null> {
    try {
        // TODO (LLM walkthrough): replace the stub with the real Claude API call. Steps, from
        // docs/llm-weekly-writeup.md:
        //   1. System prompt: explain and compare only (our code already judged the surf), no safety
        //      claims, only use the data given.
        //   2. Send the summary as JSON; ask for structured output with a JSON schema for Writeup via
        //      `output_config.format`.
        //   3. Check `stop_reason`, including "refusal" (and a cut-off reply), and catch API errors.
        //   4. Validate the reply: every bestBet must be a spot/block rated fair or good in `summary`,
        //      and every date must be one of the summary's dates.
        // buildStubWriteup can then stay as a fallback or a test fixture.
        return buildStubWriteup(summary);
    } catch (error) {
        console.log(`Failed to generate write-up for ${summary.region}:`, error);
        return null;
    }
}

// A deterministic write-up built straight from the summary, with no model. Its bestBets follow the
// same rule the model's will be checked against: only spot/blocks rated fair or good.
export function buildStubWriteup(summary: WeekSummary): Writeup {
    // "YYYY-MM-DD" strings sort correctly as plain text, so no Date parsing is needed.
    const dates = [...new Set(summary.spots.flatMap((spot) => spot.days.map((day) => day.date)))].sort();

    const days = dates.map((date) => buildStubDay(summary, date));
    const surfableDays = days.filter((day) => day.bestBets.length > 0).length;

    return {
        headline: `[Stub] ${summary.region} outlook: ${surfableDays} ${surfableDays === 1 ? "day" : "days"} with fair or better surf`,
        days,
        caveats: ["This is a placeholder generated from the ratings, not an AI-written outlook."],
    };
}

interface Candidate {
    spotId: string;
    spotName: string;
    block: DayBlock;
}

function buildStubDay(summary: WeekSummary, date: string): WriteupDay {
    const good: Candidate[] = [];
    const fair: Candidate[] = [];

    for (const spot of summary.spots) {
        const day = spot.days.find((d) => d.date === date);
        if (!day) continue;
        for (const block of day.blocks) {
            const candidate = { spotId: spot.id, spotName: spot.name, block: block.block };
            if (block.rating === "good") good.push(candidate);
            else if (block.rating === "fair") fair.push(candidate);
        }
    }

    // Prefer good blocks; fall back to fair ones only when the day has no good ones.
    const quality = good.length > 0 ? "good" : "fair";
    const picks = (good.length > 0 ? good : fair)
        .sort((a, b) => BLOCK_ORDER.indexOf(a.block) - BLOCK_ORDER.indexOf(b.block))
        .slice(0, MAX_BEST_BETS_PER_DAY);

    const summaryText = picks.length === 0
        ? "Looks flat or blown out: no spot is rated fair or better."
        : `Best bets (${quality}): ${picks.map((p) => `${p.spotName} (${p.block})`).join(", ")}.`;

    return {
        date,
        summary: summaryText,
        bestBets: picks.map((p) => ({ spotId: p.spotId, block: p.block })),
    };
}
