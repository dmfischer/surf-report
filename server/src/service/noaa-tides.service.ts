import { Station } from "../model/station";
import { TideLevel } from "../model/tide-level";

const TIDES_BASE_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";

const ONE_WEEK_IN_HOURS = 168;

const TIDES_URL_PARAMETERS = {
    product: "predictions",
    interval: "h",
    datum: "MLLW",
    units: "english",
    // GMT so times are unambiguous instants (station-local times skip/repeat hours on DST changes).
    time_zone: "gmt",
    format: "json",
    application: "surf-report",
};

// Raw NOAA shapes: on "no data" NOAA still returns 200, with an error body instead of predictions.
interface NoaaPredictionsResponse {
    predictions?: { t: string; v: string }[];
    error?: { message: string };
}

export async function getTideLevels(station: Station, now: Date = new Date()): Promise<TideLevel[]> {
    const params = new URLSearchParams({
        ...TIDES_URL_PARAMETERS,
        station: station.id,
        begin_date: formatNoaaDate(stationMidnight(now, station.timeZone)),
        range: String(ONE_WEEK_IN_HOURS),
    });

    const response = await fetch(`${TIDES_BASE_URL}?${params}`);
    if (!response.ok) {
        console.log(`Failed to load tide levels for station ${station.id}: ${response.status} ${response.statusText}`);
        return [];
    }

    const body = (await response.json()) as NoaaPredictionsResponse;
    if (!body.predictions) {
        console.log(`No tide levels for station ${station.id}: ${body.error?.message}`);
        return [];
    }

    return body.predictions.map((prediction) => ({
        // NOAA GMT times look like "2026-11-01 07:00"; make them ISO 8601 UTC.
        time: `${prediction.t.replace(" ", "T")}:00Z`,
        height: Number(prediction.v),
    }));
}

// NOAA (with time_zone=gmt) expects a UTC "YYYYMMDD HH:mm".
function formatNoaaDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    return `${year}${month}${day} ${hours}:${minutes}`;
}

// The instant of midnight starting "today" in the given zone, independent of the server's zone.
function stationMidnight(now: Date, timeZone: string): Date {
    const today = wallClock(now, timeZone);
    const midnightAsUtc = Date.UTC(today.year, today.month - 1, today.day);
    // First pass uses today's offset; the second corrects it if midnight had a different offset (DST).
    let midnight = midnightAsUtc - offsetMs(new Date(midnightAsUtc), timeZone);
    midnight = midnightAsUtc - offsetMs(new Date(midnight), timeZone);
    return new Date(midnight);
}

// The zone's UTC offset at an instant, e.g. -7h for PDT: local wall-clock time read as UTC, minus the instant.
function offsetMs(date: Date, timeZone: string): number {
    const local = wallClock(date, timeZone);
    const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
    return localAsUtc - Math.floor(date.getTime() / 60000) * 60000;
}

function wallClock(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
    return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour"), minute: part("minute") };
}
