import { describe, expect, it } from "vitest";
import { HourRating, Rating } from "../../model/hour-rating";
import { Spot } from "../../model/spot";
import { SpotConditionsResponse } from "../../model/spot-conditions-response";
import { Station } from "../../model/station";
import { SwellForecast } from "../../model/swell-forecast";
import { TideLevel } from "../../model/tide-level";
import { WindForecast } from "../../model/wind-forecast";
import { blockForHour, findTideTurns, parabolaVertex, summarizeWeek } from "./week-summary";

// REGION is America/New_York. On 2026-11-24 (EST, UTC-5) local hour h is UTC hour h + 5.

// A south-east-facing beach: offshore wind is from the NW (315°), onshore from the SE (135°).
const spot: Spot = {
    id: "test-beach", name: "Test Beach", lat: 41.4, lng: -71.5, breakType: "beach",
    facingDeg: 135, swellWindowMinDeg: 90, swellWindowMaxDeg: 200, buoyId: "44097",
};

const station: Station = {
    id: "8452660", name: "Newport", state: "RI", lat: 41.5, lng: -71.3, type: "R", timeZone: "America/New_York",
};

// Before every fixture's hours, so nothing is dropped as "already over".
const EARLY = new Date("2026-11-20T00:00:00Z");

function hourly(startIso: string, count: number): string[] {
    const start = Date.parse(startIso);
    return Array.from({ length: count }, (_, i) => new Date(start + i * 3_600_000).toISOString());
}

function rating(time: string, value: Rating, reason = `${value} at ${time}`): HourRating {
    return { time, rating: value, swellRating: value, windRating: value, reasons: [reason] };
}

function swell(time: string, directionDeg: number | null = 170): SwellForecast {
    return {
        time, waveHeightFt: 3.3,
        primarySwell: { heightFt: 3.26, periodS: 10.6, directionDeg },
        secondarySwell: null, windWaves: null,
    };
}

function wind(time: string, directionDeg: number | null, speedMph = 10): WindForecast {
    return { time, speedMph, gustMph: 14.4, directionDeg };
}

function conditions(overrides: Partial<SpotConditionsResponse> = {}): SpotConditionsResponse {
    return {
        spot, station: null, stationDistanceMiles: null, tideLevels: [], windForecast: [],
        buoy: null, swell: null, swellForecastLocation: null, swellForecast: [], ratings: [],
        ...overrides,
    };
}

describe("blockForHour", () => {
    it.each([
        { hour: 4, expected: null },
        { hour: 5, expected: "dawn" },
        { hour: 7, expected: "dawn" },
        { hour: 8, expected: "morning" }, // a boundary hour belongs to the block it starts
        { hour: 12, expected: "afternoon" },
        { hour: 16, expected: "evening" },
        { hour: 18, expected: "evening" },
        { hour: 19, expected: null },
    ])("hour $hour -> $expected", ({ hour, expected }) => {
        expect(blockForHour(hour)).toBe(expected);
    });
});

describe("summarizeWeek: blocks", () => {
    it("groups hours into local blocks, the boundary hour going to the later block", () => {
        // 06:00-09:00 local: 06 and 07 are dawn, 08 is morning.
        const times = hourly("2026-11-24T11:00:00Z", 3);
        const summary = summarizeWeek([conditions({ ratings: times.map((t) => rating(t, "fair")) })], EARLY);

        const [day] = summary.spots[0]?.days ?? [];
        expect(day?.date).toBe("2026-11-24");
        expect(day?.blocks.map((b) => [b.block, b.hours])).toEqual([["dawn", 2], ["morning", 1]]);
        expect(day?.blocks[1]?.hour).toBe("08:00");
    });

    it("drops night hours, and days that only have night hours", () => {
        // 20:00 local on the 24th to 04:00 local on the 25th: all night.
        const times = hourly("2026-11-25T01:00:00Z", 9);
        const summary = summarizeWeek([conditions({ ratings: times.map((t) => rating(t, "good")) })], EARLY);

        expect(summary.spots[0]?.days).toEqual([]);
    });

    it("rates a block by its best hour, using that hour's reasons, swell and wind", () => {
        // Morning, 08:00-11:00 local.
        const times = hourly("2026-11-24T13:00:00Z", 4);
        const ratings = [rating(times[0]!, "poor"), rating(times[1]!, "good"), rating(times[2]!, "good"), rating(times[3]!, "fair")];
        const winds = [wind(times[0]!, 135, 18), wind(times[1]!, 315, 9), wind(times[2]!, 315, 7), wind(times[3]!, 45)];
        const summary = summarizeWeek(
            [conditions({ ratings, windForecast: winds, swellForecast: times.map((t) => swell(t)) })],
            EARLY,
        );

        const block = summary.spots[0]?.days[0]?.blocks[0];
        expect(block).toEqual({
            block: "morning",
            rating: "good",
            hour: "09:00", // the earliest of the two good hours
            hoursAtRating: 2,
            hours: 4,
            reasons: [`good at ${times[1]}`],
            swell: { heightFt: 3.3, periodS: 11, direction: "S", inWindow: true },
            wind: { speedMph: 9, gustMph: 14, direction: "NW", relation: "offshore" },
        });
    });

    it.each([
        { directionDeg: 315, expected: "offshore" },
        { directionDeg: 135, expected: "onshore" },
        { directionDeg: 45, expected: "cross-shore" },
        { directionDeg: null, expected: null },
    ])("labels wind from $directionDeg as $expected", ({ directionDeg, expected }) => {
        const [time] = hourly("2026-11-24T15:00:00Z", 1);
        const summary = summarizeWeek(
            [conditions({ ratings: [rating(time!, "fair")], windForecast: [wind(time!, directionDeg)] })],
            EARLY,
        );

        expect(summary.spots[0]?.days[0]?.blocks[0]?.wind?.relation).toBe(expected);
    });

    it("marks swell outside the window", () => {
        const [time] = hourly("2026-11-24T15:00:00Z", 1);
        const summary = summarizeWeek(
            [conditions({ ratings: [rating(time!, "poor")], swellForecast: [swell(time!, 270)] })],
            EARLY,
        );

        expect(summary.spots[0]?.days[0]?.blocks[0]?.swell).toMatchObject({ direction: "W", inWindow: false });
    });

    it("leaves out hours that are already over", () => {
        // 08:00-11:00 local; now is 10:30 local, so 08 and 09 are over and 10 is still going.
        const times = hourly("2026-11-24T13:00:00Z", 4);
        const summary = summarizeWeek(
            [conditions({ ratings: times.map((t) => rating(t, "fair")) })],
            new Date("2026-11-24T15:30:00Z"),
        );

        const block = summary.spots[0]?.days[0]?.blocks[0];
        expect([block?.hour, block?.hours]).toEqual(["10:00", 2]);
    });

    it("uses local dates on a DST day: 2026-11-01 has 25 hours in New York", () => {
        // Local midnight Nov 1 (EDT, 04:00Z) to local midnight Nov 2 (EST, 05:00Z) is 25 hours.
        const times = hourly("2026-11-01T04:00:00Z", 26);
        const summary = summarizeWeek([conditions({ ratings: times.map((t) => rating(t, "fair")) })], new Date("2026-10-31T00:00:00Z"));

        const days = summary.spots[0]?.days ?? [];
        // The 26th hour is 00:00 on Nov 2, which is night, so only Nov 1 has blocks.
        expect(days.map((d) => d.date)).toEqual(["2026-11-01"]);
        // 09:00Z is 04:00 EST after the change (not 05:00 EDT), so dawn starts at 10:00Z: 05, 06, 07.
        expect(days[0]?.blocks.map((b) => [b.block, b.hour, b.hours])).toEqual([
            ["dawn", "05:00", 3],
            ["morning", "08:00", 4],
            ["afternoon", "12:00", 4],
            ["evening", "16:00", 3],
        ]);
    });
});

describe("summarizeWeek: framing and degraded input", () => {
    it("fills in the region, dates and rules", () => {
        const times = hourly("2026-11-26T15:00:00Z", 1);
        const now = new Date("2026-11-24T02:00:00Z"); // 21:00 local on the 23rd
        const summary = summarizeWeek([conditions({ ratings: times.map((t) => rating(t, "fair")) })], now);

        expect(summary).toMatchObject({
            region: "South County",
            timeZone: "America/New_York",
            generatedAt: "2026-11-24T02:00:00.000Z",
            today: "2026-11-23",
            forecastThrough: "2026-11-26",
        });
        expect(summary.ratingRules.join(" ")).toContain("under 1.5 ft");
        expect(summary.ratingRules.join(" ")).toContain("within 45°");
    });

    it("describes the spot in words", () => {
        const [spotSummary] = summarizeWeek([conditions()], EARLY).spots;

        expect(spotSummary).toMatchObject({
            id: "test-beach", name: "Test Beach", breakType: "beach",
            facing: "faces SE", swellWindow: "swell from E to SSW can reach it",
        });
    });

    it("handles a spot with no tide station, buoy or forecasts", () => {
        const summary = summarizeWeek([conditions()], EARLY);

        expect(summary.tides).toEqual([]);
        expect(summary.forecastThrough).toBe("2026-11-19"); // nothing ahead: falls back to today
        expect(summary.spots[0]).toMatchObject({ tideStationId: null, latestBuoyReading: null, days: [] });
    });

    it("gives the buoy reading's age relative to now", () => {
        const summary = summarizeWeek(
            [conditions({
                buoy: { id: "44097", name: "Block Island, RI", lat: 40.97, lng: -71.13 },
                swell: {
                    time: "2026-11-24T10:20:00.000Z", waveHeightFt: 4.27, swellHeightFt: 3.9, swellPeriodS: 11.1,
                    swellDirection: "SSE", windWaveHeightFt: 1, windWavePeriodS: 4, windWaveDirection: "S", steepness: "SWELL",
                },
            })],
            new Date("2026-11-24T12:00:00Z"),
        );

        expect(summary.spots[0]?.latestBuoyReading).toEqual({
            buoyId: "44097", buoyName: "Block Island, RI", ageHours: 1.7,
            waveHeightFt: 4.3, swellHeightFt: 3.9, swellPeriodS: 11, swellDirection: "SSE",
        });
    });
});

describe("tides", () => {
    // A symmetric tide around a high at 16:00Z (11:00 local) and a low at 22:00Z (17:00 local).
    function tide(startIso: string, heights: number[]): TideLevel[] {
        return hourly(startIso, heights.length).map((time, i) => ({ time, height: heights[i]! }));
    }

    it("parabolaVertex finds the peak between hours", () => {
        // toBeCloseTo, not toEqual: the formula gives -0 here, which toEqual treats as different from 0.
        const symmetric = parabolaVertex(1, 2, 1);
        expect(symmetric.offset).toBeCloseTo(0);
        expect(symmetric.height).toBe(2);
        // y = 4 - (x - 0.25)^2 at x = -1, 0, 1.
        const vertex = parabolaVertex(4 - 1.5625, 4 - 0.0625, 4 - 0.5625);
        expect(vertex.offset).toBeCloseTo(0.25);
        expect(vertex.height).toBeCloseTo(4);
    });

    it("finds highs and lows, counting a flat top once", () => {
        const turns = findTideTurns(tide("2026-11-24T14:00:00Z", [3, 3.5, 3.5, 3, 2, 1, 0.5, 1]));

        expect(turns.map((t) => t.kind)).toEqual(["high", "low"]);
        // The flat top is between 15:00Z and 16:00Z, so the fitted time is half an hour after 15:00Z.
        expect(new Date(turns[0]!.ms).toISOString()).toBe("2026-11-24T15:30:00.000Z");
    });

    it("summarizes each station once, in local time, with fitted times", () => {
        // Peak at 15:20Z: y = 4 - (x - 1/3)^2 sampled at 14:00Z, 15:00Z, 16:00Z, then falling to a low.
        const levels = tide("2026-11-24T14:00:00Z", [4 - 16 / 9, 4 - 1 / 9, 4 - 4 / 9, 2, 1, 2]);
        const other: Spot = { ...spot, id: "other-beach", name: "Other Beach" };
        const summary = summarizeWeek(
            [conditions({ station, tideLevels: levels }), conditions({ spot: other, station, tideLevels: levels })],
            EARLY,
        );

        expect(summary.tides).toEqual([{
            stationId: "8452660",
            stationName: "Newport",
            days: [{ date: "2026-11-24", highs: [{ time: "10:20", heightFt: 4 }], lows: [{ time: "13:00", heightFt: 1 }] }],
        }]);
        expect(summary.spots.map((s) => s.tideStationId)).toEqual(["8452660", "8452660"]);
    });
});
