import zipcodes, { ZipCode } from "zipcodes";
import { Station } from "../model/station";
import { haversineDistanceMiles } from "../util/haversine";

const STATIONS_URL =
    "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions&units=english";

// Module-level cache: Node evaluates a module once, so every importer shares this array.
let stations: Station[] = [];

export async function loadStations(): Promise<void> {
    const response: Response = await fetch(STATIONS_URL);
    if (!response.ok) {
        throw new Error(`Failed to load NOAA stations: ${response.status} ${response.statusText}`);
    }
    const body = (await response.json()) as { stations: Station[] };
    stations = body.stations;
    console.log(`Loaded ${stations.length} NOAA tide prediction stations`);
}

export function getStations(): Station[] {

    return stations;
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