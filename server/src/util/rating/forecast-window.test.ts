import { describe, expect, it } from "vitest";
import { trimToTideHours } from "./forecast-window";

const tides = [
    { time: "2026-11-15T05:00:00Z", height: 1 },
    { time: "2026-11-15T06:00:00Z", height: 2 },
    { time: "2026-11-15T07:00:00Z", height: 3 },
];

describe("trimToTideHours", () => {
    it("keeps only items within the tide chart's first and last hour, inclusive", () => {
        const items = ["04:00", "05:00", "06:00", "07:00", "08:00"].map((hour) => ({ time: `2026-11-15T${hour}:00.000Z` }));

        expect(trimToTideHours(items, tides).map((item) => item.time)).toEqual([
            "2026-11-15T05:00:00.000Z",
            "2026-11-15T06:00:00.000Z",
            "2026-11-15T07:00:00.000Z",
        ]);
    });

    it("keeps everything when there are no tides", () => {
        const items = [{ time: "2026-11-15T04:00:00Z" }];

        expect(trimToTideHours(items, [])).toEqual(items);
    });
});
