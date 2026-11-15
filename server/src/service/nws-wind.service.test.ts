import { describe, expect, it } from "vitest";
import { NwsGridpointData } from "./nws-gridpoints.service";
import { getWindForecast } from "./nws-wind.service";

// Small fake NWS layers, so these tests never touch the network.
function speedLayer(values: { validTime: string; value: number | null }[]) {
    return { uom: "wmoUnit:km_h-1", values };
}

function directionLayer(values: { validTime: string; value: number | null }[]) {
    return { uom: "wmoUnit:degree_(angle)", values };
}

describe("getWindForecast", () => {
    it("joins the layers by hour and converts km/h to whole mph", () => {
        const gridData: NwsGridpointData = {
            windSpeed: speedLayer([{ validTime: "2026-11-15T02:00:00+00:00/PT2H", value: 16.093 }]), // 10 mph
            windGust: speedLayer([{ validTime: "2026-11-15T02:00:00+00:00/PT1H", value: 32.187 }]), // 20 mph
            windDirection: directionLayer([{ validTime: "2026-11-15T02:00:00+00:00/PT2H", value: 270 }]),
        };

        expect(getWindForecast(gridData)).toEqual([
            { time: "2026-11-15T02:00:00.000Z", speedMph: 10, gustMph: 20, directionDeg: 270 },
            // The gust layer doesn't cover 03:00, so gust is null rather than 0 or missing.
            { time: "2026-11-15T03:00:00.000Z", speedMph: 10, gustMph: null, directionDeg: 270 },
        ]);
    });

    it("keeps null speeds as null", () => {
        const gridData: NwsGridpointData = {
            windSpeed: speedLayer([{ validTime: "2026-11-15T02:00:00+00:00/PT1H", value: null }]),
            windGust: speedLayer([]),
            windDirection: directionLayer([]),
        };

        expect(getWindForecast(gridData)).toEqual([
            { time: "2026-11-15T02:00:00.000Z", speedMph: null, gustMph: null, directionDeg: null },
        ]);
    });

    it("returns [] when a wind layer is missing", () => {
        expect(getWindForecast({ windSpeed: speedLayer([]), windDirection: directionLayer([]) })).toEqual([]);
    });

    it("returns [] when NWS sends unexpected units", () => {
        const gridData: NwsGridpointData = {
            windSpeed: { uom: "wmoUnit:m_s-1", values: [{ validTime: "2026-11-15T02:00:00+00:00/PT1H", value: 5 }] },
            windGust: speedLayer([]),
            windDirection: directionLayer([]),
        };

        expect(getWindForecast(gridData)).toEqual([]);
    });

    it("returns [] instead of throwing on a malformed validTime", () => {
        const gridData: NwsGridpointData = {
            windSpeed: speedLayer([{ validTime: "not-a-time", value: 5 }]),
            windGust: speedLayer([]),
            windDirection: directionLayer([]),
        };

        expect(getWindForecast(gridData)).toEqual([]);
    });
});
