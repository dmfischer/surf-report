import { Station } from "../model/station";

const STATIONS_URL =
    "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions&units=english";

// Module-level cache: Node evaluates a module once, so every importer shares this array.
let stations: Station[] = [];

export async function loadStations(): Promise<void> {
    const response = await fetch(STATIONS_URL);
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
