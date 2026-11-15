// Parsers for NDBC (National Data Buoy Center) files. NDBC has no JSON API.
import { Buoy } from "../model/buoy";

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
