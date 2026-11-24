import { describe, it, expect } from "vitest";
import { isStale, mostRecentScheduledTime, nextScheduledTime, REFRESH_HOURS } from "./writeup-schedule";
import { StoredWriteup } from "../../model/writeup";

const ZONE = "America/New_York";
// Most tests use three refreshes a day, which exercises picking between slots and days. The default
// (REFRESH_HOURS) is tested on its own at the end.
const THREE_A_DAY = [4, 12, 20];

// Times are written in UTC: EDT is UTC-4 (until 2026-11-01), EST is UTC-5.
function iso(date: Date): string {
    return date.toISOString();
}

function storedAt(generatedAt: string): StoredWriteup {
    return { region: "South County", generatedAt, writeup: { headline: "", days: [], caveats: [] } };
}

describe("mostRecentScheduledTime", () => {
    it("returns today's 12 pm in the afternoon", () => {
        // 1 pm EST
        expect(iso(mostRecentScheduledTime(new Date("2026-11-23T18:00:00Z"), ZONE, THREE_A_DAY))).toBe("2026-11-23T17:00:00.000Z");
    });

    it("returns the time itself when now is exactly on it", () => {
        expect(iso(mostRecentScheduledTime(new Date("2026-11-23T17:00:00Z"), ZONE, THREE_A_DAY))).toBe("2026-11-23T17:00:00.000Z");
    });

    it("returns the previous day's 8 pm just before 4 am", () => {
        // 3:59 am EST on the 23rd -> 8 pm EST on the 22nd
        expect(iso(mostRecentScheduledTime(new Date("2026-11-23T08:59:00Z"), ZONE, THREE_A_DAY))).toBe("2026-11-23T01:00:00.000Z");
    });

    it("crosses a month end", () => {
        // 2 am EST on Dec 1 -> 8 pm EST on Nov 30
        expect(iso(mostRecentScheduledTime(new Date("2026-12-01T07:00:00Z"), ZONE, THREE_A_DAY))).toBe("2026-12-01T01:00:00.000Z");
    });

    it("handles the spring-forward day (2026-03-08)", () => {
        // 5 am EDT, just after the 2 am change: 4 am EDT is 08:00Z
        expect(iso(mostRecentScheduledTime(new Date("2026-03-08T09:00:00Z"), ZONE, THREE_A_DAY))).toBe("2026-03-08T08:00:00.000Z");
        // 3:30 am EDT: the previous refresh is 8 pm EST on the 7th
        expect(iso(mostRecentScheduledTime(new Date("2026-03-08T07:30:00Z"), ZONE, THREE_A_DAY))).toBe("2026-03-08T01:00:00.000Z");
    });

    it("handles the fall-back day (2026-11-01)", () => {
        // 5 am EST, after the 2 am change: 4 am EST is 09:00Z
        expect(iso(mostRecentScheduledTime(new Date("2026-11-01T10:00:00Z"), ZONE, THREE_A_DAY))).toBe("2026-11-01T09:00:00.000Z");
        // 1:30 am EST (the second 1:30): the previous refresh is 8 pm EDT on Oct 31
        expect(iso(mostRecentScheduledTime(new Date("2026-11-01T06:30:00Z"), ZONE, THREE_A_DAY))).toBe("2026-11-01T00:00:00.000Z");
    });
});

describe("nextScheduledTime", () => {
    it("returns 8 pm when now is exactly 12 pm", () => {
        expect(iso(nextScheduledTime(new Date("2026-11-23T17:00:00Z"), ZONE, THREE_A_DAY))).toBe("2026-11-24T01:00:00.000Z");
    });

    it("returns tomorrow's 4 am after 8 pm", () => {
        // 9 pm EST on the 23rd -> 4 am EST on the 24th
        expect(iso(nextScheduledTime(new Date("2026-11-24T02:00:00Z"), ZONE, THREE_A_DAY))).toBe("2026-11-24T09:00:00.000Z");
    });

    it("handles the spring-forward day", () => {
        // 1 am EST -> 4 am EDT, which is 3 real hours later because 2-3 am doesn't exist
        expect(iso(nextScheduledTime(new Date("2026-03-08T06:00:00Z"), ZONE, THREE_A_DAY))).toBe("2026-03-08T08:00:00.000Z");
    });

    it("handles the fall-back day", () => {
        // 8 pm EDT on Oct 31 -> 4 am EST on Nov 1 (9 real hours, because 1-2 am happens twice)
        expect(iso(nextScheduledTime(new Date("2026-11-01T00:00:00Z"), ZONE, THREE_A_DAY))).toBe("2026-11-01T09:00:00.000Z");
        // 4 am EST -> 12 pm EST
        expect(iso(nextScheduledTime(new Date("2026-11-01T09:00:00Z"), ZONE, THREE_A_DAY))).toBe("2026-11-01T17:00:00.000Z");
    });

    it("uses custom hours", () => {
        // 1 pm EST, hours [6] -> 6 am EST tomorrow
        expect(iso(nextScheduledTime(new Date("2026-11-23T18:00:00Z"), ZONE, [6]))).toBe("2026-11-24T11:00:00.000Z");
    });
});

describe("isStale", () => {
    // Restart at 1 pm EST on 2026-11-23 (the example in docs/llm-weekly-writeup.md).
    const restart = new Date("2026-11-23T18:00:00Z");

    it("keeps a copy written at 12:05 pm", () => {
        expect(isStale(storedAt("2026-11-23T17:05:00Z"), restart, ZONE, THREE_A_DAY)).toBe(false);
    });

    it("replaces a copy written at 4:05 am, because the 12 pm refresh was missed", () => {
        expect(isStale(storedAt("2026-11-23T09:05:00Z"), restart, ZONE, THREE_A_DAY)).toBe(true);
    });

    it("keeps a copy written exactly at the scheduled time", () => {
        expect(isStale(storedAt("2026-11-23T17:00:00.000Z"), restart, ZONE, THREE_A_DAY)).toBe(false);
    });

    it("is stale when there's no saved copy", () => {
        expect(isStale(null, restart, ZONE, THREE_A_DAY)).toBe(true);
    });

    it("is stale when generatedAt can't be parsed", () => {
        expect(isStale(storedAt("not a date"), restart, ZONE, THREE_A_DAY)).toBe(true);
    });
});

describe("the default schedule (REFRESH_HOURS)", () => {
    it("is once a day at 4 am", () => {
        expect(REFRESH_HOURS).toEqual([4]);
    });

    it("keeps a copy from 4:05 am all day, until the next 4 am", () => {
        const stored = storedAt("2026-11-23T09:05:00Z"); // 4:05 am EST
        expect(isStale(stored, new Date("2026-11-23T18:00:00Z"), ZONE)).toBe(false); // 1 pm
        expect(isStale(stored, new Date("2026-11-24T09:30:00Z"), ZONE)).toBe(true); // 4:30 am next day
    });

    it("schedules the next run for tomorrow's 4 am", () => {
        expect(iso(nextScheduledTime(new Date("2026-11-23T18:00:00Z"), ZONE))).toBe("2026-11-24T09:00:00.000Z");
    });
});
