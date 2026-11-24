import { Spot } from "../../model/spot";
import { SpotConditionsResponse } from "../../model/spot-conditions-response";
import { trimToTideHours } from "../../util/rating/forecast-window";
import { rateHours } from "../../util/rating/rating";
import { getBuoy } from "../ndbc/ndbc-buoys.service";
import { getLatestSwell } from "../ndbc/ndbc-swell.service";
import { DEFAULT_MAX_STATION_DISTANCE_MILES, findNearestStation } from "../noaa/noaa-stations.service";
import { getTideLevels } from "../noaa/noaa-tides.service";
import { getGridpointData } from "../nws/nws-gridpoints.service";
import { getWindForecast } from "../nws/nws-wind.service";
import { getSwellForecast } from "../open-meteo/open-meteo-swell.service";

// Conditions for one surf spot. Same data sources as the zip-based getConditions, but every location
// comes from the spot: wind and swell forecast at the spot, measured swell from the spot's chosen buoy,
// tides from the station nearest the spot.
export async function getSpotConditions(spot: Spot): Promise<SpotConditionsResponse> {
    const location = { lat: spot.lat, lng: spot.lng };

    const nearest = findNearestStation(location);
    const station = nearest && nearest.distanceMiles <= DEFAULT_MAX_STATION_DISTANCE_MILES ? nearest.station : null;

    // The buoy list loads at startup; if the spot's buoy isn't in it, swell is simply unavailable.
    const buoy = getBuoy(spot.buoyId) ?? null;
    if (!buoy) {
        console.log(`Buoy ${spot.buoyId} for spot ${spot.id} isn't in the loaded wave-buoy list`);
    }

    // All four sources are independent, so request them at the same time.
    const [tideLevels, gridData, swell, swellForecast] = await Promise.all([
        station ? getTideLevels(station) : [],
        getGridpointData(location),
        buoy ? getLatestSwell(buoy) : null,
        getSwellForecast(location),
    ]);
    const windHours = trimToTideHours(gridData ? getWindForecast(gridData) : [], tideLevels);
    const swellHours = trimToTideHours(swellForecast?.forecast ?? [], tideLevels);

    return {
        spot,
        station,
        stationDistanceMiles: station && nearest ? Math.round(nearest.distanceMiles * 10) / 10 : null,
        tideLevels,
        windForecast: windHours,
        buoy,
        swell,
        swellForecastLocation: swellForecast?.location ?? null,
        swellForecast: swellHours,
        ratings: rateHours(spot, swellHours, windHours),
    };
}
