import { describe, expect, it } from "vitest";
import { parseActiveStations, parseSpecFileIds } from "./ndbc";

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
