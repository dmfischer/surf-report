export interface Station {
    id: string;
    name: string;
    state: string;
    lat: number;
    lng: number;
    type: 'R' | 'S';
}
