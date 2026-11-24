import { DayBlock } from "../../model/week-summary";
import { StoredWriteup } from "../../model/writeup";

const DAY_BLOCKS: readonly DayBlock[] = ["dawn", "morning", "afternoon", "evening"];

// JSON.parse returns `any`, and a file on disk can be anything (an old format, a half-written save,
// a hand edit). This checks the shape at runtime so the rest of the code can trust the types.
// `value is StoredWriteup` is a type guard: where it returns true, TypeScript treats value as one.
export function isStoredWriteup(value: unknown): value is StoredWriteup {
    if (!isObject(value)) return false;
    return (
        typeof value.region === "string" &&
        typeof value.generatedAt === "string" &&
        !Number.isNaN(Date.parse(value.generatedAt)) &&
        isWriteup(value.writeup)
    );
}

function isWriteup(value: unknown): boolean {
    if (!isObject(value)) return false;
    return (
        typeof value.headline === "string" &&
        Array.isArray(value.days) &&
        value.days.every(isWriteupDay) &&
        Array.isArray(value.caveats) &&
        value.caveats.every((caveat) => typeof caveat === "string")
    );
}

function isWriteupDay(value: unknown): boolean {
    if (!isObject(value)) return false;
    return (
        typeof value.date === "string" &&
        typeof value.summary === "string" &&
        Array.isArray(value.bestBets) &&
        value.bestBets.every(isBestBet)
    );
}

function isBestBet(value: unknown): boolean {
    if (!isObject(value)) return false;
    return typeof value.spotId === "string" && DAY_BLOCKS.includes(value.block as DayBlock);
}

// Arrays are objects too, so exclude them; null is typeof "object", so exclude it as well.
function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
