import { ConditionsResponse } from "../model/conditions-response";
import { Station } from "../model/station";
import { haversineDistanceMiles } from "../util/haversine";
import { getStations } from "./noaa-stations.service";
import { ZipCode } from "zipcodes";
import zipcodes from 'zipcodes';

export async function getConditions(zipCode: string): Promise<ConditionsResponse> {
    const station: Station | null = await findStation(zipCode);
    return new ConditionsResponse(zipCode, "flat", station);
}

const cache: Map<String, Station> = new Map();

export async function findStation(zipCode: string): Promise<Station | null> {
    const cachedStation = cache.get(zipCode);
    if (cachedStation) {
        return cachedStation;
    }

    let lat = 0;
    let lng = 0;
    
    const foundZipCode: ZipCode | undefined = zipcodes.lookup(zipCode);

    if (foundZipCode != null) {
        lat = foundZipCode.latitude;
        lng = foundZipCode.longitude;
    }

    const stations: Station[] = getStations();
    
    let minDistance = 25_000;
    let closest: Station | null = null;
    stations.forEach(station => {
        const distance = haversineDistanceMiles(lat, lng, station.lat, station.lng);
        if (distance < minDistance) {
            minDistance = distance;
            closest = station;
        }
    });

    if (closest) {
        cache.set(zipCode, closest);
    }

    return closest;
}