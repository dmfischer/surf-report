import { Station } from "../model/station";
import { TideLevel } from "../model/tide-level";

const TIDES_BASE_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";

const ONE_WEEK_IN_HOURS = 168;

const TIDES_URL_PARAMETERS = {
    product: "predictions",
    interval: "h",
    datum: "MLLW",
    units: "english",
    time_zone: "lst_ldt",
    format: "json",
    application: "surf-report",
};

// Raw NOAA shapes: on "no data" NOAA still returns 200, with an error body instead of predictions.
interface NoaaPredictionsResponse {
    predictions?: { t: string; v: string }[];
    error?: { message: string };
}

export async function getTideLevels(station: Station): Promise<TideLevel[]> {
    const params = new URLSearchParams({
        ...TIDES_URL_PARAMETERS,
        station: station.id,
        begin_date: formatNoaaDate(new Date()),
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
        time: prediction.t,
        height: Number(prediction.v),
    }));
}

// NOAA expects dates as YYYYMMDD.
function formatNoaaDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
}
