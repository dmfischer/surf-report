import { ConditionsResponse } from "../model/conditions-response";
import { Station } from "../model/station";
import { haversineDistanceMiles } from "../util/haversine";
import { getStations } from "./noaa-stations.service";
import zipcodes, { ZipCode } from "zipcodes";

export async function getConditions(zipCode: string): Promise<ConditionsResponse> {
    const station: Station | null = findStation(zipCode);
    return new ConditionsResponse(zipCode, "flat", station);
}

const cache: Map<string, Station> = new Map();

export function findStation(zipCode: string): Station | null {
    const cachedStation = cache.get(zipCode);
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
        cache.set(zipCode, closest);
    }

    return closest;
}