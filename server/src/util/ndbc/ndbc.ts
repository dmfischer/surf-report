// Parsers for NDBC (National Data Buoy Center) files. NDBC has no JSON API.
import { Buoy } from "../../model/buoy";
import { SwellReading } from "../../model/swell-reading";

const FEET_PER_METRE = 3.28084;

// NDBC's "no value" markers. -99 shows up in direction columns, N/A in STEEPNESS.
const MISSING_VALUES = new Set(["MM", "-99", "N/A"]);

// Parses a realtime2/{id}.spec file into readings, newest first (the file's order). Example:
//   #YY  MM DD hh mm WVHT  SwH  SwP  WWH  WWP SwD WWD  STEEPNESS  APD MWD
//   #yr  mo dy hr mn    m    m  sec    m  sec  -  degT     -      sec degT
//   2026 11 15 20 26  1.4  1.2 16.7  0.7  9.9  SW  SW      SWELL 10.5 217
// Columns are found by name from the "#YY" header line rather than by position, in case NDBC adds one.
// Rows without a total wave height are skipped: those are gaps, not readings.
export function parseSpecReadings(text: string): SwellReading[] {
    const lines = text.split("\n");
    const header = lines.find((line) => line.startsWith("#YY"));
    if (!header) {
        throw new Error("No #YY header line in .spec file");
    }
    const columns = header.slice(1).trim().split(/\s+/); // drop the "#", then split on runs of spaces

    const readings: SwellReading[] = [];
    for (const line of lines) {
        if (line.startsWith("#") || line.trim() === "") {
            continue;
        }

        const fields = line.trim().split(/\s+/);
        const raw = (column: string): string | null => {
            const value = fields[columns.indexOf(column)];
            return value === undefined || MISSING_VALUES.has(value) ? null : value;
        };
        const number = (column: string): number | null => {
            const value = raw(column);
            return value === null || !Number.isFinite(Number(value)) ? null : Number(value);
        };
        const feet = (column: string): number | null => {
            const metres = number(column);
            return metres === null ? null : Math.round(metres * FEET_PER_METRE * 10) / 10;
        };

        // The first five columns are the UTC date and time.
        const [year, month, day, hour, minute] = ["YY", "MM", "DD", "hh", "mm"].map(number);
        if (year == null || month == null || day == null || hour == null || minute == null || number("WVHT") === null) {
            continue;
        }

        readings.push({
            time: new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString(),
            waveHeightFt: feet("WVHT"),
            swellHeightFt: feet("SwH"),
            swellPeriodS: number("SwP"),
            swellDirection: raw("SwD"),
            windWaveHeightFt: feet("WWH"),
            windWavePeriodS: number("WWP"),
            windWaveDirection: raw("WWD"),
            steepness: raw("STEEPNESS"),
        });
    }

    return readings;
}

// activestations.xml is a flat list of self-closing tags, e.g.
//   <station id="46285" lat="33.445" lon="-117.68" elev="0" name="Capistrano Beach Nearshore, CA (284)" ... />
// That's simple enough for regular expressions, so no XML library is needed.
export function parseActiveStations(xml: string): Buoy[] {
    const buoys: Buoy[] = [];

    for (const tag of xml.match(/<station\s[^>]*\/>/g) ?? []) {
        const attributes = new Map<string, string>();
        for (const [, key, value] of tag.matchAll(/(\w+)="([^"]*)"/g)) {
            if (key !== undefined && value !== undefined) {
                attributes.set(key, decodeXmlEntities(value));
            }
        }

        const id = attributes.get("id");
        const lat = Number(attributes.get("lat"));
        const lng = Number(attributes.get("lon"));
        // Number(undefined) is NaN, so this also skips tags missing lat or lon.
        if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            continue;
        }

        buoys.push({ id, name: attributes.get("name") ?? "", lat, lng });
    }

    return buoys;
}

// The realtime2/ directory listing is HTML with one link per file, e.g. <a href="46285.spec">.
// A station has wave data if it has a .spec file. Ids are returned uppercase, as in the file names.
export function parseSpecFileIds(html: string): Set<string> {
    const ids = new Set<string>();
    for (const [, id] of html.matchAll(/href="([^"/]+)\.spec"/g)) {
        if (id) {
            ids.add(id.toUpperCase());
        }
    }
    return ids;
}

function decodeXmlEntities(text: string): string {
    return text
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&"); // last, so "&amp;lt;" becomes "&lt;", not "<"
}
