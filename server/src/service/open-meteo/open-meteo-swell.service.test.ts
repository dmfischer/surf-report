import { describe, expect, it } from "vitest";
import { toSwellForecasts } from "./open-meteo-swell.service";

describe("toSwellForecasts", () => {
    it("turns parallel arrays into one forecast per hour, in feet, with UTC times", () => {
        const forecasts = toSwellForecasts({
            time: ["2026-11-15T08:00", "2026-11-15T09:00"],
            wave_height: [1.88, 1.9],
            swell_wave_height: [1.6, 1.5],
            swell_wave_period: [12.8, 12.9],
            swell_wave_direction: [278, 279],
            secondary_swell_wave_height: [0.66, 0.7],
            secondary_swell_wave_period: [12.85, 13],
            secondary_swell_wave_direction: [188, 189],
            wind_wave_height: [0.04, 0.1],
            wind_wave_period: [0.9, 1.2],
            wind_wave_direction: [230, 231],
        });

        expect(forecasts).toHaveLength(2);
        expect(forecasts[0]).toEqual({
            time: "2026-11-15T08:00:00Z",
            waveHeightFt: 6.2,
            primarySwell: { heightFt: 5.2, periodS: 12.8, directionDeg: 278 },
            secondarySwell: { heightFt: 2.2, periodS: 12.85, directionDeg: 188 },
            windWaves: { heightFt: 0.1, periodS: 0.9, directionDeg: 230 },
        });
    });

    it("makes a component null when its height is null (e.g. a land cell)", () => {
        const [forecast] = toSwellForecasts({
            time: ["2026-11-15T08:00"],
            wave_height: [null],
            swell_wave_height: [null],
            swell_wave_direction: [278], // Open-Meteo still sends directions over land
        });

        expect(forecast).toEqual({
            time: "2026-11-15T08:00:00Z",
            waveHeightFt: null,
            primarySwell: null,
            secondarySwell: null,
            windWaves: null,
        });
    });

    it("treats a missing variable array as no value", () => {
        const [forecast] = toSwellForecasts({
            time: ["2026-11-15T08:00"],
            swell_wave_height: [1],
        });

        expect(forecast?.primarySwell).toEqual({ heightFt: 3.3, periodS: null, directionDeg: null });
    });
});
