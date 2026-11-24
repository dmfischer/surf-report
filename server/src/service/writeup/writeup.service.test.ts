import { describe, expect, it } from "vitest";
import { DayBlock, SpotDaySummary, SpotSummary, WeekSummary } from "../../model/week-summary";
import { Rating } from "../../model/hour-rating";
import { buildStubWriteup, readWriteupReply, WriteupReply } from "./writeup.service";

// Only the fields the stub reads matter; the rest are filler so the fixture satisfies WeekSummary.
function day(date: string, ratings: Partial<Record<DayBlock, Rating>>): SpotDaySummary {
    return {
        date,
        blocks: Object.entries(ratings).map(([block, rating]) => ({
            block: block as DayBlock,
            rating: rating as Rating,
            hour: "06:00",
            hoursAtRating: 1,
            hours: 1,
            reasons: [],
            swell: null,
            wind: null,
        })),
    };
}

function spot(id: string, name: string, days: SpotDaySummary[]): SpotSummary {
    return {
        id,
        name,
        breakType: "beach",
        facing: "faces S",
        swellWindow: "swell from E to SW can reach it",
        tideStationId: null,
        latestBuoyReading: null,
        days,
    };
}

function weekSummary(spots: SpotSummary[]): WeekSummary {
    return {
        region: "South County",
        timeZone: "America/New_York",
        generatedAt: "2026-11-23T17:00:00.000Z",
        today: "2026-11-23",
        forecastThrough: "2026-11-25",
        ratingRules: [],
        notes: [],
        tides: [],
        spots,
    };
}

// Days are deliberately out of order to check the sort.
const mixedWeek = weekSummary([
    spot("narragansett", "Narragansett Town Beach", [
        day("2026-11-24", { dawn: "fair", morning: "poor" }),
        day("2026-11-23", { dawn: "poor", morning: "fair", afternoon: "good" }),
        day("2026-11-25", { dawn: "poor", morning: "poor" }),
    ]),
    spot("point-judith", "Point Judith", [
        day("2026-11-23", { dawn: "good", morning: "poor" }),
        day("2026-11-24", { dawn: "poor", afternoon: "fair" }),
        day("2026-11-25", { dawn: "poor", morning: "poor" }),
    ]),
]);

// Every best bet must point at a spot/block rated fair or good on that date: the same rule the
// model's output will be checked against.
function ratingOf(summary: WeekSummary, spotId: string, date: string, block: DayBlock): Rating | undefined {
    return summary.spots
        .find((s) => s.id === spotId)
        ?.days.find((d) => d.date === date)
        ?.blocks.find((b) => b.block === block)?.rating;
}

describe("buildStubWriteup", () => {
    it("has one day per date, in date order", () => {
        const writeup = buildStubWriteup(mixedWeek);
        expect(writeup.days.map((d) => d.date)).toEqual(["2026-11-23", "2026-11-24", "2026-11-25"]);
    });

    it("only picks spot/blocks rated fair or good", () => {
        const writeup = buildStubWriteup(mixedWeek);
        for (const d of writeup.days) {
            for (const bet of d.bestBets) {
                expect(["fair", "good"]).toContain(ratingOf(mixedWeek, bet.spotId, d.date, bet.block));
            }
        }
    });

    it("prefers good blocks over fair ones, in block order", () => {
        const [monday] = buildStubWriteup(mixedWeek).days;
        expect(monday?.bestBets).toEqual([
            { spotId: "point-judith", block: "dawn" },
            { spotId: "narragansett", block: "afternoon" },
        ]);
        expect(monday?.summary).toBe("Best bets (good): Point Judith (dawn), Narragansett Town Beach (afternoon).");
    });

    it("falls back to fair blocks when a day has no good ones", () => {
        const tuesday = buildStubWriteup(mixedWeek).days[1];
        expect(tuesday?.bestBets).toEqual([
            { spotId: "narragansett", block: "dawn" },
            { spotId: "point-judith", block: "afternoon" },
        ]);
    });

    it("caps the best bets per day", () => {
        const busy = weekSummary([
            spot("a", "A", [day("2026-11-23", { dawn: "good", morning: "good", afternoon: "good", evening: "good" })]),
        ]);
        expect(buildStubWriteup(busy).days[0]?.bestBets).toHaveLength(3);
    });

    it("marks itself as a stub", () => {
        const writeup = buildStubWriteup(mixedWeek);
        expect(writeup.headline).toBe("[Stub] South County outlook: 2 days with fair or better surf");
        expect(writeup.caveats.join(" ")).toMatch(/not an AI/);
    });

    it("gives an all-poor week empty best bets and a flat summary", () => {
        const flatWeek = weekSummary([
            spot("narragansett", "Narragansett Town Beach", [day("2026-11-23", { dawn: "poor", morning: "poor" })]),
            spot("point-judith", "Point Judith", [day("2026-11-23", { dawn: "poor" })]),
        ]);
        const writeup = buildStubWriteup(flatWeek);
        expect(writeup.days).toHaveLength(1);
        expect(writeup.days[0]?.bestBets).toEqual([]);
        expect(writeup.days[0]?.summary).toMatch(/flat/);
        expect(writeup.headline).toContain("0 days");
    });
});

// generateWriteup itself calls the API, so it isn't tested here (tests must never spend money).
// What it does with the reply is readWriteupReply, tested with made-up replies.
describe("readWriteupReply", () => {
    const writeup = buildStubWriteup(mixedWeek);
    const finished: WriteupReply = { stop_reason: "end_turn", stop_details: null, parsed_output: writeup };

    it("returns the parsed write-up when the model finished", () => {
        expect(readWriteupReply(finished)).toBe(writeup);
    });

    it("returns null for a refusal", () => {
        const refused: WriteupReply = {
            stop_reason: "refusal",
            stop_details: { type: "refusal", category: null, explanation: null },
            parsed_output: null,
        };
        expect(readWriteupReply(refused)).toBeNull();
    });

    it("returns null for a reply cut off by max_tokens, even if part of it parsed", () => {
        expect(readWriteupReply({ ...finished, stop_reason: "max_tokens" })).toBeNull();
    });

    it("returns null when the reply didn't match the schema", () => {
        expect(readWriteupReply({ ...finished, parsed_output: null })).toBeNull();
    });
});
