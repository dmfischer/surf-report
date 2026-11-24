import { describe, expect, it } from "vitest";
import { expandLayer, parseDurationHours, parseValidTime } from "./nws";

describe("expandLayer", () => {
    it("expands each range into one entry per hour, keyed by ISO UTC time", () => {
        const hourly = expandLayer({
            uom: "wmoUnit:km_h-1",
            values: [
                { validTime: "2026-11-15T02:00:00+00:00/PT1H", value: 5 },
                { validTime: "2026-11-15T03:00:00+00:00/PT2H", value: 12 },
            ],
        });

        // Spreading a Map gives [key, value] pairs in insertion order.
        expect([...hourly]).toEqual([
            ["2026-11-15T02:00:00.000Z", 5],
            ["2026-11-15T03:00:00.000Z", 12],
            ["2026-11-15T04:00:00.000Z", 12],
        ]);
    });

    it("keeps null values", () => {
        const hourly = expandLayer({
            uom: "wmoUnit:km_h-1",
            values: [{ validTime: "2026-11-15T02:00:00+00:00/PT2H", value: null }],
        });

        expect(hourly.get("2026-11-15T03:00:00.000Z")).toBeNull();
    });

    it("crosses midnight correctly", () => {
        const hourly = expandLayer({
            uom: "wmoUnit:km_h-1",
            values: [{ validTime: "2026-11-15T23:00:00+00:00/PT2H", value: 7 }],
        });

        expect([...hourly.keys()]).toEqual(["2026-11-15T23:00:00.000Z", "2026-11-16T00:00:00.000Z"]);
    });

    it("returns an empty map for an empty layer", () => {
        expect(expandLayer({ uom: "wmoUnit:km_h-1", values: [] }).size).toBe(0);
    });
});

describe("parseDurationHours", () => {
    // it.each runs the same test once per row; $duration and $hours fill in the test name.
    it.each([
        { duration: "PT1H", hours: 1 },
        { duration: "PT13H", hours: 13 },
        { duration: "P1D", hours: 24 },
        { duration: "P1DT6H", hours: 30 },
        { duration: "P7D", hours: 168 },
    ])("converts $duration to $hours hours", ({ duration, hours }) => {
        expect(parseDurationHours(duration)).toBe(hours);
    });

    it.each(["", "PT", "PT1.5H", "P1W", "garbage"])("throws on invalid duration %j", (duration) => {
        expect(() => parseDurationHours(duration)).toThrow();
    });
});

describe("parseValidTime", () => {
    it("splits a UTC start time and duration", () => {
        const result = parseValidTime("2026-11-15T02:00:00+00:00/PT3H");

        expect(result.start.toISOString()).toBe("2026-11-15T02:00:00.000Z");
        expect(result.hours).toBe(3);
    });

    it("converts a non-UTC offset to the correct instant", () => {
        const result = parseValidTime("2026-11-15T02:00:00-08:00/P1DT2H");

        expect(result.start.toISOString()).toBe("2026-11-15T10:00:00.000Z");
        expect(result.hours).toBe(26);
    });

    it("throws when there is no duration", () => {
        expect(() => parseValidTime("2026-11-15T02:00:00+00:00")).toThrow();
    });

    it("throws when the start time is not a valid date", () => {
        expect(() => parseValidTime("not-a-date/PT1H")).toThrow();
    });
});
