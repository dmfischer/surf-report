import { describe, expect, it } from "vitest";
import { SPOTS } from "../../data/spots";
import { Spot } from "../../model/spot";
import { findSpotsNear, getSpot } from "./spots.service";

describe("findSpotsNear", () => {
    it("returns the Narragansett spots for 02882, nearest first, with distances", () => {
        const result = findSpotsNear("02882");

        expect(result.status).toBe("ok");
        expect(result.zipLocation).not.toBeNull();
        expect(result.spots.map((spot) => spot.id).sort()).toEqual(
            ["matunuck", "monahans-dock", "narragansett-town-beach", "point-judith", "scarborough"],
        );
        const distances = result.spots.map((spot) => spot.distanceMiles);
        expect(distances).toEqual([...distances].sort((a, b) => a - b));
    });

    it("returns no spots for a zip far from any (the client then falls back to zip conditions)", () => {
        const result = findSpotsNear("92651"); // Laguna Beach, CA

        expect(result.status).toBe("ok");
        expect(result.spots).toEqual([]);
    });

    it("reports an unknown zip", () => {
        expect(findSpotsNear("00000")).toMatchObject({ status: "unknown_zip", zipLocation: null, spots: [] });
    });

    it("respects the distance limit", () => {
        const farSpot: Spot = { ...SPOTS[0]!, id: "far", lat: 42.5 }; // about 75 miles north of 02882

        expect(findSpotsNear("02882", 25, [farSpot]).spots).toEqual([]);
        expect(findSpotsNear("02882", 100, [farSpot]).spots.map((spot) => spot.id)).toEqual(["far"]);
    });
});

describe("getSpot", () => {
    it("finds a spot by id, or undefined", () => {
        expect(getSpot("point-judith")?.name).toBe("Point Judith");
        expect(getSpot("nope")).toBeUndefined();
    });
});

describe("SPOTS data", () => {
    it("has unique, URL-safe ids and sensible values", () => {
        const ids = SPOTS.map((spot) => spot.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const spot of SPOTS) {
            expect(spot.id).toMatch(/^[a-z0-9-]+$/);
            expect(spot.facingDeg).toBeGreaterThanOrEqual(0);
            expect(spot.facingDeg).toBeLessThan(360);
            expect(Math.abs(spot.lat)).toBeLessThanOrEqual(90);
            expect(Math.abs(spot.lng)).toBeLessThanOrEqual(180);
        }
    });
});
