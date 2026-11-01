export interface Station {
    id: string;
    name: string;
    state: string;
    lat: number;
    lng: number;
    type: 'R' | 'S';
    // IANA zone (e.g. "America/Los_Angeles"), derived from lat/lng when stations are loaded.
    timeZone: string;
}
