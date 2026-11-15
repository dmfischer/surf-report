import { describe, expect, it } from "vitest";
import { parseActiveStations, parseSpecFileIds, parseSpecReadings } from "./ndbc";

const SPEC_HEADER = `#YY  MM DD hh mm WVHT  SwH  SwP  WWH  WWP SwD WWD  STEEPNESS  APD MWD
#yr  mo dy hr mn    m    m  sec    m  sec  -  degT     -      sec degT`;

describe("parseSpecReadings", () => {
    it("parses a row into a reading, converting metres to feet", () => {
        const text = `${SPEC_HEADER}
2026 11 15 20 26  1.4  1.2 16.7  0.7  9.9  SW  SW      SWELL 10.5 217
`;

        expect(parseSpecReadings(text)).toEqual([{
            time: "2026-11-15T20:26:00.000Z",
            waveHeightFt: 4.6,
            swellHeightFt: 3.9,
            swellPeriodS: 16.7,
            swellDirection: "SW",
            windWaveHeightFt: 2.3,
            windWavePeriodS: 9.9,
            windWaveDirection: "SW",
            steepness: "SWELL",
        }]);
    });

    it("turns MM, -99 and N/A into null", () => {
        const text = `${SPEC_HEADER}
2026 11 01 19 10  0.2   MM   MM   MM   MM  MM  MM        N/A  2.4 -99`;

        expect(parseSpecReadings(text)[0]).toMatchObject({
            waveHeightFt: 0.7,
            swellHeightFt: null,
            swellPeriodS: null,
            swellDirection: null,
            steepness: null,
        });
    });

    it("skips rows with no total wave height, and keeps the file's newest-first order", () => {
        const text = `${SPEC_HEADER}
2026 11 15 21 00   MM   MM   MM   MM   MM  MM  MM         MM   MM  MM
2026 11 15 20 30  0.8  0.1 11.8  0.8  3.1 SSE  NW VERY_STEEP  3.1 313
2026 11 15 20 00  0.8  0.1 11.8  0.8  3.1  SE  NW VERY_STEEP  3.1 308`;

        expect(parseSpecReadings(text).map((reading) => reading.time)).toEqual([
            "2026-11-15T20:30:00.000Z",
            "2026-11-15T20:00:00.000Z",
        ]);
    });

    it("throws when the header line is missing", () => {
        expect(() => parseSpecReadings("<html>Not found</html>")).toThrow();
    });
});

describe("parseActiveStations", () => {
    it("reads id, name and coordinates from each station tag", () => {
        const xml = `<?xml version="1.0" encoding="utf-8"?><stations created="2026-11-15T20:50:02UTC" count="2">
  <station id="46285" lat="33.445" lon="-117.68" elev="0" name="Capistrano Beach Nearshore, CA (284)" owner="SCRIPPS" type="buoy" met="y"/>
  <station id="44097" lat="40.966" lon="-71.123" elev="0" name="Block Island, RI  (154)" owner="SCRIPPS" type="buoy" met="y"/>
</stations>`;

        expect(parseActiveStations(xml)).toEqual([
            { id: "46285", name: "Capistrano Beach Nearshore, CA (284)", lat: 33.445, lng: -117.68 },
            { id: "44097", name: "Block Island, RI  (154)", lat: 40.966, lng: -71.123 },
        ]);
    });

    it("decodes XML entities in names", () => {
        const xml = `<station id="x1" lat="1" lon="2" name="Bob &amp; Sons &quot;Pier&quot;"/>`;

        expect(parseActiveStations(xml)[0]?.name).toBe('Bob & Sons "Pier"');
    });

    it("skips stations with missing or invalid coordinates", () => {
        const xml = `<station id="a" lat="1" name="no lon"/><station id="b" lat="x" lon="2"/><station id="c" lat="3" lon="4"/>`;

        expect(parseActiveStations(xml).map((buoy) => buoy.id)).toEqual(["c"]);
    });
});

describe("parseSpecFileIds", () => {
    it("collects the ids of .spec files only, uppercased", () => {
        const html = `<a href="41002.spec">41002.spec</a> <a href="41002.txt">41002.txt</a>
<a href="buzm3.spec">buzm3.spec</a> <a href="46285.spec">46285.spec</a> <a href="../">Parent</a>`;

        expect([...parseSpecFileIds(html)]).toEqual(["41002", "BUZM3", "46285"]);
    });
});
