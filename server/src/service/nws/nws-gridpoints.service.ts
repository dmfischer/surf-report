import { LatLng } from "../../model/lat-lng";
import { NwsGridLayer } from "../../util/nws/nws";

// NWS (api.weather.gov) is a different API from NOAA CO-OPS: different base URL, GeoJSON responses,
// and it requires an identifying User-Agent (Node's fetch sends just "node" by default).
const NWS_BASE_URL = "https://api.weather.gov";

const NWS_HEADERS = {
    "User-Agent": "surf-report (learning project)",
    Accept: "application/geo+json",
};

const FETCH_TIMEOUT_MS = 10_000;

// Raw NWS shape for GET /points/{lat},{lng}: only the fields we need.
interface NwsPointsResponse {
    properties?: {
        gridId: string; // forecast office, e.g. "SGX"
        gridX: number;
        gridY: number;
        forecastGridData: string; // full URL of /gridpoints/{gridId}/{gridX},{gridY}
    };
}

// The layers of GET /gridpoints/{gridId}/{gridX},{gridY} that we use (the response has ~68).
// One response holds wind AND wave layers, so it's fetched once and shared by the parsing services.
// Every layer is optional: not every forecast office publishes every layer (e.g. Boston has no swell),
// so each parsing service checks for the layers it needs.
// This raw NWS shape is shared only with the nws-*.service files; they map it to our own models.
export interface NwsGridpointData {
    windSpeed?: NwsGridLayer;
    windGust?: NwsGridLayer;
    windDirection?: NwsGridLayer;
}

interface NwsGridpointResponse {
    properties?: NwsGridpointData;
}

// Fetches the forecast grid data covering a location: two requests, /points then /gridpoints.
// Returns null on any failure (logged, not thrown).
export async function getGridpointData(location: LatLng): Promise<NwsGridpointData | null> {
    const gridDataUrl = await getGridDataUrl(location);
    if (!gridDataUrl) {
        return null; // getGridDataUrl already logged why.
    }

    try {
        const response = await fetch(gridDataUrl, { headers: NWS_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!response.ok) {
            console.log(`Failed to get grid data from ${gridDataUrl}: ${response.status} ${response.statusText}`);
            return null;
        }

        const body = await response.json() as NwsGridpointResponse;
        if (!body.properties) {
            console.log(`Grid data properties missing from ${gridDataUrl}`);
            return null;
        }

        return body.properties;
    } catch (error) {
        console.log(`Failed to get grid data from ${gridDataUrl}`, error);
        return null;
    }
}

// Asks NWS which forecast grid cell covers this location, and returns the URL of that cell's raw data.
async function getGridDataUrl(location: LatLng): Promise<string | null> {
    // NWS rejects more than 4 decimal places.
    const url = `${NWS_BASE_URL}/points/${location.lat.toFixed(4)},${location.lng.toFixed(4)}`;

    try {
        const response = await fetch(url, { headers: NWS_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!response.ok) {
            console.log(`Failed to get grid point for ${location.lat} ${location.lng}: ${response.status} ${response.statusText}`);
            return null;
        }

        const body = await response.json() as NwsPointsResponse;
        if (!body.properties) {
            console.log(`Grid point properties missing for ${location.lat} ${location.lng}`);
            return null;
        }

        return body.properties.forecastGridData;
    } catch (error) {
        console.log(`Failed to get grid point for ${location.lat} ${location.lng}`, error);
        return null;
    }
}
