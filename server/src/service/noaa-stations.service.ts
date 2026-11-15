import tzlookup from "@photostructure/tz-lookup";
import zipcodes, { ZipCode } from "zipcodes";
import { LatLng } from "../model/lat-lng";
import { Station } from "../model/station";
import { haversineDistanceMiles } from "../util/haversine";

const STATIONS_URL =
    "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions&units=english";

const FETCH_TIMEOUT_MS = 10_000;

// Module-level cache: Node evaluates a module once, so every importer shares this array.
let stations: Station[] = [];

export async function loadStations(): Promise<void> {
    const response: Response = await fetch(STATIONS_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) {
        throw new Error(`Failed to load NOAA stations: ${response.status} ${response.statusText}`);
    }
    const body = (await response.json()) as { stations: Omit<Station, "timeZone">[] };
    // NOAA gives no IANA zone (only a standard-time offset), so derive it once here from lat/lng, offline.
    stations = body.stations.map((station) => ({ ...station, timeZone: tzlookup(station.lat, station.lng) }));
    console.log(`Loaded ${stations.length} NOAA tide prediction stations`);
}

export function getStations(includeSubordinate?: boolean): Station[] {
    if (includeSubordinate) {
        return stations;
    }

    return stations.filter(station => station.type === 'R');
}

export const DEFAULT_MAX_STATION_DISTANCE_MILES = 50;

export type StationLookup =
    | { status: "ok"; zipLocation: LatLng; station: Station; distanceMiles: number }
    | { status: "unknown_zip" }
    | { status: "no_nearby_station" };

interface NearestStation {
    // Center of the zip code itself (from the zipcodes dataset), so callers can map it.
    zipLocation: LatLng;
    station: Station;
    distanceMiles: number;
}

// Caches the nearest station regardless of distance, so any maxDistanceMiles
// can be applied to a cached entry (this also remembers "none in range").
const stationCache: Map<string, NearestStation> = new Map();

export function findStation(
    zipCode: string,
    maxDistanceMiles: number = DEFAULT_MAX_STATION_DISTANCE_MILES,
): StationLookup {
    let nearest: NearestStation | undefined = stationCache.get(zipCode);

    if (!nearest) {
        const foundZipCode: ZipCode | undefined = zipcodes.lookup(zipCode);

        if (!foundZipCode) {
            return { status: "unknown_zip" };
        }

        const zipLocation = { lat: foundZipCode.latitude, lng: foundZipCode.longitude };
        const found = findNearestStation(zipLocation);
        if (found) {
            nearest = { zipLocation, ...found };
            stationCache.set(zipCode, nearest);
        }
    }

    if (!nearest || nearest.distanceMiles > maxDistanceMiles) {
        return { status: "no_nearby_station" };
    }

    return {
        status: "ok",
        zipLocation: nearest.zipLocation,
        station: nearest.station,
        distanceMiles: nearest.distanceMiles,
    };
}

// The nearest reference station to any point, regardless of distance (callers apply their own limit),
// or null if no stations are loaded. Used for zip codes above and for surf spots.
export function findNearestStation(location: LatLng): { station: Station; distanceMiles: number } | null {
    let nearest: { station: Station; distanceMiles: number } | null = null;
    for (const station of getStations()) {
        const distanceMiles = haversineDistanceMiles(location.lat, location.lng, station.lat, station.lng);
        if (!nearest || distanceMiles < nearest.distanceMiles) {
            nearest = { station, distanceMiles };
        }
    }
    return nearest;
}