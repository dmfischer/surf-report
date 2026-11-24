import { describe, expect, it } from "vitest";
import { Rating } from "../../model/hour-rating";
import { DayBlock, SpotSummary, WeekSummary } from "../../model/week-summary";
import { Writeup } from "../../model/writeup";
import { validateWriteup } from "./writeup-validation";

// A spot whose blocks have the given ratings on each date. Only the fields validation reads matter;
// the rest are filler so the fixture satisfies the types.
function spot(id: string, days: Record<string, Partial<Record<DayBlock, Rating>>>): SpotSummary {
    return {
        id,
        name: id,
        breakType: "beach",
        facing: "faces S",
        swellWindow: "swell from E to SW can reach it",
        tideStationId: null,
        latestBuoyReading: null,
        days: Object.entries(days).map(([date, blocks]) => ({
            date,
            blocks: Object.entries(blocks).map(([block, rating]) => ({
                block: block as DayBlock,
                rating: rating as Rating,
                hour: "06:00",
                hoursAtRating: 1,
                hours: 1,
                reasons: [],
                swell: null,
                wind: null,
            })),
        })),
    };
}

const summary: WeekSummary = {
    region: "South County",
    timeZone: "America/New_York",
    generatedAt: "2026-11-23T17:00:00.000Z",
    today: "2026-11-23",
    forecastThrough: "2026-11-25",
    ratingRules: [],
    notes: [],
    tides: [],
    spots: [
        spot("matunuck", {
            "2026-11-24": { dawn: "good", morning: "fair", afternoon: "poor" },
            "2026-11-25": { dawn: "fair", morning: "fair", afternoon: "fair", evening: "fair" },
        }),
        spot("point-judith", {
            "2026-11-24": { dawn: "poor", afternoon: "good" },
            "2026-11-25": { dawn: "fair" },
        }),
    ],
};

function writeup(days: Writeup["days"]): Writeup {
    return { headline: "Headline", days, caveats: [] };
}

describe("validateWriteup", () => {
    it("keeps a write-up that follows the data, with no issues", () => {
        const input = writeup([
            {
                date: "2026-11-24",
                summary: "Good at dawn.",
                bestBets: [{ spotId: "matunuck", block: "dawn" }, { spotId: "point-judith", block: "afternoon" }],
            },
        ]);
        const { writeup: result, issues } = validateWriteup(input, summary);
        expect(result).toEqual(input);
        expect(issues).toEqual([]);
    });

    it("drops a best bet on a poor block", () => {
        const input = writeup([
            { date: "2026-11-24", summary: "", bestBets: [{ spotId: "point-judith", block: "dawn" }] },
        ]);
        const { writeup: result, issues } = validateWriteup(input, summary);
        expect(result.days[0]?.bestBets).toEqual([]);
        expect(issues).toEqual(["Dropped best bet point-judith dawn on 2026-11-24: rated poor"]);
    });

    it("drops a best bet for an unknown spot or a block with no data", () => {
        const input = writeup([
            {
                date: "2026-11-24",
                summary: "",
                bestBets: [{ spotId: "made-up-spot", block: "dawn" }, { spotId: "matunuck", block: "evening" }],
            },
        ]);
        const { writeup: result, issues } = validateWriteup(input, summary);
        expect(result.days[0]?.bestBets).toEqual([]);
        expect(issues).toHaveLength(2);
        expect(issues.every((issue) => issue.endsWith("not in the summary"))).toBe(true);
    });

    it("keeps only the first best bets past the daily cap", () => {
        const input = writeup([
            {
                date: "2026-11-25",
                summary: "",
                bestBets: [
                    { spotId: "matunuck", block: "dawn" },
                    { spotId: "point-judith", block: "dawn" },
                    { spotId: "matunuck", block: "morning" },
                    { spotId: "matunuck", block: "afternoon" },
                ],
            },
        ]);
        const { writeup: result, issues } = validateWriteup(input, summary);
        expect(result.days[0]?.bestBets.map((bet) => `${bet.spotId} ${bet.block}`)).toEqual([
            "matunuck dawn", "point-judith dawn", "matunuck morning",
        ]);
        expect(issues).toEqual(["Dropped best bet matunuck afternoon on 2026-11-25: more than 3 that day"]);
    });

    it("drops a repeated best bet without it counting toward the cap", () => {
        const input = writeup([
            {
                date: "2026-11-24",
                summary: "",
                bestBets: [{ spotId: "matunuck", block: "dawn" }, { spotId: "matunuck", block: "dawn" }],
            },
        ]);
        const { writeup: result, issues } = validateWriteup(input, summary);
        expect(result.days[0]?.bestBets).toEqual([{ spotId: "matunuck", block: "dawn" }]);
        expect(issues).toEqual(["Dropped repeated best bet matunuck dawn on 2026-11-24"]);
    });

    it("checks the rating on the day's own date, not another day's", () => {
        // matunuck afternoon is poor on the 24th but fair on the 25th.
        const input = writeup([
            { date: "2026-11-24", summary: "", bestBets: [{ spotId: "matunuck", block: "afternoon" }] },
            { date: "2026-11-25", summary: "", bestBets: [{ spotId: "matunuck", block: "afternoon" }] },
        ]);
        const { writeup: result } = validateWriteup(input, summary);
        expect(result.days.map((day) => day.bestBets.length)).toEqual([0, 1]);
    });

    it("drops days that aren't in the summary or repeat an earlier day", () => {
        const input = writeup([
            { date: "2026-11-24", summary: "first", bestBets: [] },
            { date: "2026-12-01", summary: "beyond the forecast", bestBets: [] },
            { date: "2026-11-24", summary: "again", bestBets: [] },
        ]);
        const { writeup: result, issues } = validateWriteup(input, summary);
        expect(result.days.map((day) => day.summary)).toEqual(["first"]);
        expect(issues).toEqual(["Dropped day 2026-12-01: not in the summary", "Dropped repeated day 2026-11-24"]);
    });

    it("puts days in date order", () => {
        const input = writeup([
            { date: "2026-11-25", summary: "", bestBets: [] },
            { date: "2026-11-24", summary: "", bestBets: [] },
        ]);
        expect(validateWriteup(input, summary).writeup.days.map((day) => day.date)).toEqual(["2026-11-24", "2026-11-25"]);
    });

    it("keeps the headline and caveats as they are", () => {
        const input = { headline: "Flat all week.", days: [], caveats: ["Buoy reading is 9 hours old."] };
        expect(validateWriteup(input, summary)).toEqual({ writeup: input, issues: [] });
    });
});
