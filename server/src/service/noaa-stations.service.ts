import tzlookup from "@photostructure/tz-lookup";
import zipcodes, { ZipCode } from "zipcodes";
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

const stationCache: Map<string, Station> = new Map();

export function findStation(zipCode: string): Station | null {
    const cachedStation = stationCache.get(zipCode);
    if (cachedStation) {
        return cachedStation;
    }
    
    const foundZipCode: ZipCode | undefined = zipcodes.lookup(zipCode);

    if (!foundZipCode) {
        return null;
    }

    const lat = foundZipCode.latitude;
    const lng = foundZipCode.longitude;
    
    let minDistance = Infinity;
    let closest: Station | null = null;

    for (const station of getStations()) {
        const distance = haversineDistanceMiles(lat, lng, station.lat, station.lng);
        if (distance < minDistance) {
            minDistance = distance;
            closest = station;
        }
    }

    if (closest) {
        stationCache.set(zipCode, closest);
    }

    return closest;
}