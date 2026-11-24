import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DayBlock, WeekSummary } from "../../model/week-summary";
import { Writeup, WriteupDay } from "../../model/writeup";
// Shared with the prompt and the validation, so a great day doesn't turn into a list of every block.
import { buildWriteupUserMessage, MAX_BEST_BETS_PER_DAY, WRITEUP_SYSTEM_PROMPT } from "../../util/writeup/writeup-prompt";
import { WriteupSchema } from "../../util/writeup/writeup-schema";
import { validateWriteup } from "../../util/writeup/writeup-validation";

const MODEL = "claude-opus-5-5";
// How hard the model thinks before answering. Opus 5.5 always thinks (there's no "off"), and effort is
// the only control. "medium" is its default, set explicitly so it's visible here; comparing a few spots
// over a week is moderate work. Revisit once there are real write-ups to judge.
const EFFORT = "medium";
// Upper bound on the reply, thinking included. A write-up is ~1-2k tokens; the headroom is for the
// thinking. Reaching it cuts the JSON off (stop_reason "max_tokens"), which we treat as a failure.
const MAX_TOKENS = 16_000;

// One client for the whole process. It reads ANTHROPIC_API_KEY from the environment (server/.env via
// `npm run dev`). Without a key it's still created; the request then fails and is caught below.
// The SDK retries rate limits, overloads and connection errors twice by itself before throwing.
const client = new Anthropic();

// Returns null on failure (logged, not thrown), like the other services, so the scheduler can keep
// the previous write-up.
export async function generateWriteup(summary: WeekSummary): Promise<Writeup | null> {
    try {
        // parse() is create() plus checking the reply against WriteupSchema: the reply's text is
        // parsed into `parsed_output`, a typed object (null if it didn't fit).
        const response = await client.messages.parse({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            // No `thinking` field: on Opus 5.5, leaving it out means adaptive thinking (the model
            // decides how much to think), which is what we want.
            output_config: {
                effort: EFFORT,
                // Structured output: the API only lets the model produce JSON matching the schema.
                format: zodOutputFormat(WriteupSchema),
            },
            system: WRITEUP_SYSTEM_PROMPT,
            messages: [{ role: "user", content: buildWriteupUserMessage(summary) }],
        });

        // Logged on every run so the real cost per write-up can be checked against the plan's estimate.
        console.log(
            `Write-up for ${summary.region}: ${response.usage.input_tokens} input / ` +
            `${response.usage.output_tokens} output tokens (${response.stop_reason})`,
        );
        const writeup = readWriteupReply(response);
        if (!writeup) {
            return null;
        }

        // Keep only what our own ratings support (see util/writeup/writeup-validation.ts). Each issue
        // is logged, so a prompt that the model keeps misreading shows up in the server log.
        const { writeup: validated, issues } = validateWriteup(writeup, summary);
        for (const issue of issues) {
            console.log(`Write-up check: ${issue}`);
        }
        return validated;
    } catch (error) {
        logApiError(summary.region, error);
        return null;
    }
}

// The parts of a parse() reply that decide whether we can use it (field types from the SDK).
export interface WriteupReply {
    stop_reason: Anthropic.Messages.StopReason | null;
    stop_details: Anthropic.Messages.RefusalStopDetails | null;
    parsed_output: Writeup | null;
}

// What a reply means, separate from the network call so it can be tested with made-up replies.
// Anything other than a complete reply that fits the schema is a failure (null), and the scheduler
// keeps the previous write-up.
export function readWriteupReply(reply: WriteupReply): Writeup | null {
    // A refusal comes back as a normal reply (HTTP 200), not an error, so it has to be checked for.
    if (reply.stop_reason === "refusal") {
        const category = reply.stop_details?.category ?? "no category";
        console.log(`Write-up refused (${category}): ${reply.stop_details?.explanation ?? ""}`);
        return null;
    }
    // "end_turn" means the model finished. Anything else (most likely "max_tokens") means the JSON
    // may be cut off, so don't use it even if part of it parsed.
    if (reply.stop_reason !== "end_turn") {
        console.log(`Write-up stopped early (${reply.stop_reason}); ignoring it`);
        return null;
    }
    if (!reply.parsed_output) {
        console.log("Write-up reply didn't match the schema; ignoring it");
        return null;
    }
    return reply.parsed_output;
}

// Most specific error first: a missing or wrong key needs a different fix than a busy API.
function logApiError(region: string, error: unknown) {
    const prefix = `Failed to generate write-up for ${region}:`;
    if (error instanceof Anthropic.AuthenticationError) {
        console.log(`${prefix} the API key was rejected. Check ANTHROPIC_API_KEY in server/.env.`);
    } else if (error instanceof Anthropic.RateLimitError) {
        console.log(`${prefix} rate limited (after the SDK's retries); the next scheduled run will try again.`);
    } else if (error instanceof Anthropic.APIConnectionError) {
        console.log(`${prefix} couldn't reach the API (${error.message}).`);
    } else if (error instanceof Anthropic.APIError) {
        console.log(`${prefix} API error ${error.status}: ${error.message}`);
    } else {
        // E.g. no credentials at all, which the SDK reports before sending anything.
        console.log(prefix, error);
    }
}

// Blocks in the order they happen in a day, for sorting best bets.
const BLOCK_ORDER: DayBlock[] = ["dawn", "morning", "afternoon", "evening"];

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
