// An NDBC buoy that reports waves (it has a realtime .spec file).
export interface Buoy {
    id: string; // e.g. "46285"
    name: string; // e.g. "Capistrano Beach Nearshore, CA (284)"
    lat: number;
    lng: number;
}
