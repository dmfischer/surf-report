import { Buoy } from "../model/buoy";
import { LatLng } from "../model/lat-lng";
import { haversineDistanceMiles } from "../util/haversine";
import { parseActiveStations, parseSpecFileIds } from "../util/ndbc";

const ACTIVE_STATIONS_URL = "https://www.ndbc.noaa.gov/activestations.xml";
// Directory listing of realtime files; a <id>.spec file means the station reports waves.
const REALTIME_LISTING_URL = "https://www.ndbc.noaa.gov/data/realtime2/";

const FETCH_TIMEOUT_MS = 10_000;

export const DEFAULT_MAX_BUOY_DISTANCE_MILES = 50;

// Module-level cache, like the tide stations: loaded once at startup.
let buoys: Buoy[] = [];

// Loads the wave-reporting buoys. Unlike loadStations, a failure here doesn't stop the server:
// buoys are optional, so it's logged and buoys stays empty (responses then have buoy: null).
export async function loadBuoys(): Promise<void> {
    try {
        const [stationsXml, listingHtml] = await Promise.all([
            fetchText(ACTIVE_STATIONS_URL),
            fetchText(REALTIME_LISTING_URL),
        ]);

        // activestations.xml lists ~1,350 stations, but only ~250 measure waves.
        const specIds = parseSpecFileIds(listingHtml);
        buoys = parseActiveStations(stationsXml).filter((buoy) => specIds.has(buoy.id.toUpperCase()));
        console.log(`Loaded ${buoys.length} NDBC wave buoys`);
    } catch (error) {
        console.log("Failed to load NDBC buoys; continuing without them:", error);
    }
}

export interface NearestBuoy {
    buoy: Buoy;
    distanceMiles: number;
}

// The nearest wave buoy within maxDistanceMiles, or null.
// Note: nearest isn't always best. In RI it picks Buzzards Bay (44085, sheltered) over Block Island
// (44097); see docs/research/buoy-swell-data.md §7. Revisit before using it for swell.
export function findBuoy(location: LatLng, maxDistanceMiles: number = DEFAULT_MAX_BUOY_DISTANCE_MILES): NearestBuoy | null {
    let nearest: NearestBuoy | null = null;

    for (const buoy of buoys) {
        const distanceMiles = haversineDistanceMiles(location.lat, location.lng, buoy.lat, buoy.lng);
        if (!nearest || distanceMiles < nearest.distanceMiles) {
            nearest = { buoy, distanceMiles };
        }
    }

    return nearest && nearest.distanceMiles <= maxDistanceMiles ? nearest : null;
}

async function fetchText(url: string): Promise<string> {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) {
        throw new Error(`${url}: ${response.status} ${response.statusText}`);
    }
    return response.text();
}
