import { LatLng } from "../model/lat-lng";
import { SwellForecast, WaveComponent } from "../model/swell-forecast";

// Open-Meteo's free tier is for non-commercial use, and its data (CC BY 4.0) must be credited
// on the page: the client shows "Swell forecast: Open-Meteo.com".
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";

const FETCH_TIMEOUT_MS = 10_000;

const FEET_PER_METRE = 3.28084;

const HOURLY_VARIABLES = [
    "wave_height",
    "swell_wave_height", "swell_wave_period", "swell_wave_direction",
    "secondary_swell_wave_height", "secondary_swell_wave_period", "secondary_swell_wave_direction",
    "wind_wave_height", "wind_wave_period", "wind_wave_direction",
] as const;

type HourlyVariable = (typeof HOURLY_VARIABLES)[number];

// Raw Open-Meteo shape: one array per variable, all the same length as `time` ("parallel arrays").
// Index i of every array belongs to the hour time[i].
export interface OpenMeteoMarineResponse {
    latitude?: number; // the grid cell actually used, which can differ from the one asked for
    longitude?: number;
    hourly?: { time: string[] } & Partial<Record<HourlyVariable, (number | null)[]>>;
    error?: boolean;
    reason?: string;
}

export interface SwellForecastResult {
    // Where the forecast is for: the nearest ocean grid cell to the requested point.
    location: LatLng;
    forecast: SwellForecast[];
}

// Hourly swell forecast for the ocean near `location`. Returns null on any failure (logged, not thrown).
export async function getSwellForecast(location: LatLng): Promise<SwellForecastResult | null> {
    const params = new URLSearchParams({
        latitude: String(location.lat),
        longitude: String(location.lng),
        hourly: HOURLY_VARIABLES.join(","),
        // 8 days, so the tide chart's week (which starts at the station's midnight) is always covered.
        forecast_days: "8",
        timezone: "GMT",
        // A zip code's center is usually on land, where wave values are all null. "sea" makes
        // Open-Meteo use the nearest ocean grid cell instead.
        cell_selection: "sea",
    });

    try {
        const response = await fetch(`${MARINE_URL}?${params}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        // Open-Meteo reports bad requests as HTTP 400 with { error: true, reason }.
        const body = (await response.json()) as OpenMeteoMarineResponse;
        if (!response.ok || body.error || !body.hourly) {
            console.log(`Failed to load swell forecast for ${location.lat} ${location.lng}: ${response.status} ${body.reason ?? ""}`);
            return null;
        }

        return {
            location: { lat: body.latitude ?? location.lat, lng: body.longitude ?? location.lng },
            forecast: toSwellForecasts(body.hourly),
        };
    } catch (error) {
        console.log(`Failed to load swell forecast for ${location.lat} ${location.lng}:`, error);
        return null;
    }
}

// Turns Open-Meteo's parallel arrays into one SwellForecast per hour, converting metres to feet.
export function toSwellForecasts(hourly: NonNullable<OpenMeteoMarineResponse["hourly"]>): SwellForecast[] {
    const value = (variable: HourlyVariable, i: number): number | null => hourly[variable]?.[i] ?? null;

    const component = (prefix: "swell_wave" | "secondary_swell_wave" | "wind_wave", i: number): WaveComponent | null => {
        const heightM = value(`${prefix}_height`, i);
        if (heightM === null) {
            return null;
        }
        return {
            heightFt: toFeet(heightM),
            periodS: value(`${prefix}_period`, i),
            directionDeg: value(`${prefix}_direction`, i),
        };
    };

    return hourly.time.map((time, i) => {
        const waveHeightM = value("wave_height", i);
        return {
            // With timezone=GMT, Open-Meteo gives "2026-11-15T08:00" (UTC, but no "Z"); make it explicit.
            time: `${time}:00Z`,
            waveHeightFt: waveHeightM === null ? null : toFeet(waveHeightM),
            primarySwell: component("swell_wave", i),
            secondarySwell: component("secondary_swell_wave", i),
            windWaves: component("wind_wave", i),
        };
    });
}

// Metres to feet, rounded to 1 decimal.
function toFeet(metres: number): number {
    return Math.round(metres * FEET_PER_METRE * 10) / 10;
}
