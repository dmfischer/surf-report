import { describe, expect, it } from "vitest";
import { WeekSummary } from "../../model/week-summary";
import { buildWriteupUserMessage, MAX_BEST_BETS_PER_DAY, WRITEUP_SYSTEM_PROMPT } from "./writeup-prompt";

const summary: WeekSummary = {
    region: "South County",
    timeZone: "America/New_York",
    generatedAt: "2026-11-23T17:00:00.000Z",
    today: "2026-11-23",
    forecastThrough: "2026-11-29",
    ratingRules: ["Swell under 1.5 ft is poor"],
    notes: [],
    tides: [],
    spots: [],
};

describe("WRITEUP_SYSTEM_PROMPT", () => {
    it("states the same best-bet cap that validation uses", () => {
        expect(WRITEUP_SYSTEM_PROMPT).toContain(`at most ${MAX_BEST_BETS_PER_DAY}`);
    });
});

describe("buildWriteupUserMessage", () => {
    it("includes the whole summary as JSON inside the tag", () => {
        const message = buildWriteupUserMessage(summary);
        const inner = message.split("<week_summary>\n")[1]?.split("\n</week_summary>")[0];
        expect(JSON.parse(inner ?? "")).toEqual(summary);
    });

    it("names the region, time zone and today", () => {
        const message = buildWriteupUserMessage(summary);
        expect(message).toContain("South County");
        expect(message).toContain("America/New_York");
        expect(message).toContain("today is 2026-11-23");
    });

    it("is the same for the same summary", () => {
        expect(buildWriteupUserMessage(summary)).toBe(buildWriteupUserMessage(summary));
    });
});
