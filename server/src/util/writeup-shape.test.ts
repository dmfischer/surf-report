import { describe, expect, it } from "vitest";
import { isStoredWriteup } from "./writeup-shape";

function validStored() {
    return {
        region: "south-county-ri",
        generatedAt: "2026-11-23T17:00:05.000Z",
        writeup: {
            headline: "Small but clean early in the week",
            days: [
                {
                    date: "2026-11-23",
                    summary: "Knee-high and offshore at dawn.",
                    bestBets: [{ spotId: "narragansett-town-beach", block: "dawn" }],
                },
                { date: "2026-11-24", summary: "Flat.", bestBets: [] },
            ],
            caveats: ["Forecast confidence drops after Thursday."],
        },
    };
}

describe("isStoredWriteup", () => {
    it("accepts a valid stored write-up", () => {
        expect(isStoredWriteup(validStored())).toBe(true);
    });

    it("rejects values that aren't objects", () => {
        expect(isStoredWriteup(null)).toBe(false);
        expect(isStoredWriteup("hello")).toBe(false);
        expect(isStoredWriteup([])).toBe(false);
    });

    it("rejects a missing or unparseable generatedAt", () => {
        expect(isStoredWriteup({ ...validStored(), generatedAt: undefined })).toBe(false);
        expect(isStoredWriteup({ ...validStored(), generatedAt: "yesterday-ish" })).toBe(false);
    });

    it("rejects a missing region or writeup", () => {
        expect(isStoredWriteup({ ...validStored(), region: 7 })).toBe(false);
        expect(isStoredWriteup({ ...validStored(), writeup: null })).toBe(false);
    });

    it("rejects a malformed day", () => {
        const stored = validStored();
        stored.writeup.days.push({ date: "2026-11-25", summary: 42, bestBets: [] } as never);
        expect(isStoredWriteup(stored)).toBe(false);
    });

    it("rejects a best bet with an unknown block or no spot id", () => {
        // Adds a day whose only best bet is `bet`. Typed loosely on purpose, to build invalid data.
        const withBet = (bet: object) => {
            const stored = validStored();
            stored.writeup.days.push({ date: "2026-11-25", summary: "s", bestBets: [bet] } as never);
            return stored;
        };
        expect(isStoredWriteup(withBet({ spotId: "narragansett-town-beach", block: "dawn" }))).toBe(true);
        expect(isStoredWriteup(withBet({ spotId: "narragansett-town-beach", block: "midnight" }))).toBe(false);
        expect(isStoredWriteup(withBet({ block: "dawn" }))).toBe(false);
    });

    it("rejects non-string caveats", () => {
        const stored = validStored();
        (stored.writeup.caveats as unknown[]).push(3);
        expect(isStoredWriteup(stored)).toBe(false);
    });
});
