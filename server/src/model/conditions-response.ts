import { Station } from "./station";

export class ConditionsResponse {
    zipCode: string;
    description: string;
    station: Station | null;

    constructor(zipCode: string, description: string, station: Station | null) {
        this.zipCode = zipCode;
        this.description = description;
        this.station = station;
    }
}