import { Station } from "../model/station";
import { TidePrediction } from "../model/tide-prediction";

const TIDES_BASE_URL =
    "https://api.tidesandcurrents.noaa.gov/mdapi/prod/datagetter";

const TIDES_URL_PARAMETERS: URLSearchParams = new URLSearchParams({
    type: 'tidepredictions',
    units: 'english',
});

export async function getTidePrediction(station: Station): Promise<TidePrediction | null> {
    const response: Response = await fetch(`${TIDES_BASE_URL}${TIDES_URL_PARAMETERS}`);
    if (!response.ok) {
        console.log(`Failed to load tide prediction: ${response.status} ${response.statusText}`);
        return null;
    }
    const body = (await response.json()) as { tidePrediction: TidePrediction };


    return body.tidePrediction;
}