import { Buoy } from "../model/buoy";
import { SwellReading } from "../model/swell-reading";
import { parseSpecReadings } from "../util/ndbc";

const NDBC_REALTIME_URL = "https://www.ndbc.noaa.gov/data/realtime2";

const FETCH_TIMEOUT_MS = 10_000;

// The buoy's most recent wave reading (swell and wind waves). This is a measurement, not a forecast.
// Returns null on any failure or when the buoy has no readings (logged, not thrown).
export async function getLatestSwell(buoy: Buoy): Promise<SwellReading | null> {
    // realtime2 file names are uppercase, even for the few stations whose ids aren't.
    const url = `${NDBC_REALTIME_URL}/${buoy.id.toUpperCase()}.spec`;

    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!response.ok) {
            console.log(`Failed to load swell for buoy ${buoy.id}: ${response.status} ${response.statusText}`);
            return null;
        }

        // The file is newest first, so the first reading is the latest.
        return parseSpecReadings(await response.text())[0] ?? null;
    } catch (error) {
        // Network errors and timeouts, plus parseSpecReadings throwing on an unexpected file.
        console.log(`Failed to load swell for buoy ${buoy.id}:`, error);
        return null;
    }
}
