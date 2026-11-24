import { describe, expect, it } from "vitest";
import { Spot } from "../../model/spot";
import { SwellForecast, WaveComponent } from "../../model/swell-forecast";
import { WindForecast } from "../../model/wind-forecast";
import { angleBetween, isInWindow, rateHour, rateHours, toCompass, windRelation } from "./rating";

// A south-east-facing beach: offshore wind is from the NW (315°), swell window E to SSW.
const spot: Spot = {
    id: "test-beach", name: "Test Beach", lat: 41.4, lng: -71.5, breakType: "beach",
    facingDeg: 135, swellWindowMinDeg: 90, swellWindowMaxDeg: 200, buoyId: "44097",
};

const TIME = "2026-11-16T12:00:00Z";

function swellHour(primary: WaveComponent | null, secondary: WaveComponent | null = null): SwellForecast {
    return { time: TIME, waveHeightFt: primary?.heightFt ?? null, primarySwell: primary, secondarySwell: secondary, windWaves: null };
}

function windHour(speedMph: number | null, directionDeg: number | null): WindForecast {
    return { time: "2026-11-16T12:00:00.000Z", speedMph, gustMph: null, directionDeg };
}

const goodSwell: WaveComponent = { heightFt: 4, periodS: 12, directionDeg: 170 };

describe("rateHour: swell", () => {
    it.each([
        { name: "good: big, long period, in window", swell: goodSwell, expected: "good" },
        { name: "fair: in window but small", swell: { heightFt: 2, periodS: 12, directionDeg: 170 }, expected: "fair" },
        { name: "fair: in window but short period", swell: { heightFt: 4, periodS: 7, directionDeg: 170 }, expected: "fair" },
        { name: "good: big enough to make up for a mid period", swell: { heightFt: 7, periodS: 8, directionDeg: 160 }, expected: "good" },
        { name: "fair: big but short period", swell: { heightFt: 7, periodS: 6, directionDeg: 160 }, expected: "fair" },
        { name: "poor: too small", swell: { heightFt: 1, periodS: 12, directionDeg: 170 }, expected: "poor" },
        { name: "poor: wind chop period", swell: { heightFt: 4, periodS: 4, directionDeg: 170 }, expected: "poor" },
        { name: "poor: outside the window (from the west)", swell: { heightFt: 6, periodS: 14, directionDeg: 270 }, expected: "poor" },
    ])("$name", ({ swell, expected }) => {
        expect(rateHour(spot, swellHour(swell), windHour(3, 0)).swellRating).toBe(expected);
    });

    it("uses the better of primary and secondary swell", () => {
        const blocked: WaveComponent = { heightFt: 6, periodS: 14, directionDeg: 270 };
        const result = rateHour(spot, swellHour(blocked, goodSwell), windHour(3, 0));

        expect(result.swellRating).toBe("good");
        expect(result.reasons[0]).toContain("from S");
    });

    it("rates no swell as poor", () => {
        expect(rateHour(spot, swellHour(null), undefined).rating).toBe("poor");
    });
});

describe("rateHour: wind", () => {
    it.each([
        { name: "light wind from anywhere is good", wind: windHour(4, 135), expected: "good" },
        { name: "offshore (from NW) is good", wind: windHour(15, 315), expected: "good" },
        { name: "near offshore (from N, 45° off) is good", wind: windHour(15, 0), expected: "good" },
        { name: "cross-shore (from NE) is fair", wind: windHour(15, 45), expected: "fair" },
        { name: "light onshore is fair", wind: windHour(10, 135), expected: "fair" },
        { name: "strong onshore (from SE) is poor", wind: windHour(18, 135), expected: "poor" },
    ])("$name", ({ wind, expected }) => {
        expect(rateHour(spot, swellHour(goodSwell), wind).windRating).toBe(expected);
    });
});

describe("rateHour: overall", () => {
    it("is the worst of swell and wind", () => {
        const result = rateHour(spot, swellHour(goodSwell), windHour(18, 135));

        expect(result).toMatchObject({ rating: "poor", swellRating: "good", windRating: "poor" });
        expect(result.reasons).toEqual(["Swell 4 ft @ 12 s from S (in window)", "Wind 18 mph from SE (strong onshore)"]);
    });

    it("uses swell alone when there's no wind forecast", () => {
        const result = rateHour(spot, swellHour(goodSwell), undefined);

        expect(result).toMatchObject({ rating: "good", windRating: null });
        expect(result.reasons).toContain("No wind forecast");
    });
});

describe("rateHours", () => {
    it("matches wind to swell by hour even when the time strings differ", () => {
        const [result] = rateHours(spot, [swellHour(goodSwell)], [windHour(18, 135)]); // "…Z" vs "…000Z"

        expect(result?.windRating).toBe("poor");
    });
});

describe("angleBetween", () => {
    it.each([[10, 350, 20], [0, 180, 180], [90, 90, 0], [315, 45, 90]])("%i and %i are %i° apart", (a, b, expected) => {
        expect(angleBetween(a, b)).toBe(expected);
    });
});

describe("isInWindow", () => {
    it("handles a normal window", () => {
        expect(isInWindow(150, 90, 200)).toBe(true);
        expect(isInWindow(250, 90, 200)).toBe(false);
    });

    it("handles a window that crosses north", () => {
        expect(isInWindow(10, 300, 30)).toBe(true);
        expect(isInWindow(310, 300, 30)).toBe(true);
        expect(isInWindow(180, 300, 30)).toBe(false);
    });
});

describe("windRelation", () => {
    it.each([
        { directionDeg: 315, expected: "offshore" }, // straight offshore for a SE-facing beach
        { directionDeg: 0, expected: "offshore" }, // 45° off: still offshore
        { directionDeg: 45, expected: "cross-shore" },
        { directionDeg: 225, expected: "cross-shore" },
        { directionDeg: 90, expected: "onshore" }, // 45° off straight onshore
        { directionDeg: 135, expected: "onshore" },
    ])("wind from $directionDeg is $expected", ({ directionDeg, expected }) => {
        expect(windRelation(spot, directionDeg)).toBe(expected);
    });
});

describe("toCompass", () => {
    it.each([
        { degrees: 0, expected: "N" },
        { degrees: 135, expected: "SE" },
        { degrees: 200, expected: "SSW" },
        { degrees: 355, expected: "N" }, // rounds up past NNW back to N
    ])("$degrees° is $expected", ({ degrees, expected }) => {
        expect(toCompass(degrees)).toBe(expected);
    });
});
