import { useRef, useState } from 'react';
import ZipCodeForm from './ZipCodeForm';
import { getConditions } from '../services/conditions.service';
import { getSpotConditions, getSpots } from '../services/spots.service';
import type { ConditionsResponse } from '../types/conditions';
import type { SpotConditionsResponse, SpotsResponse } from '../types/spots';
import { toCompass } from '../utils/direction';
import { toRatingBands } from '../utils/rating-bands';
import RatingCaption from './RatingCaption';
import SpotsMap from './SpotsMap';
import TideChart from './TideChart';
import StationMap from './StationMap';
import SwellCaption from './SwellCaption';
import SwellForecastCaption from './SwellForecastCaption';

const MS_PER_HOUR = 60 * 60 * 1000;

// The forecast hour containing `timestamp`, or undefined if the forecast doesn't cover it.
// Generic, so it works for both wind and swell forecasts (anything with an hourly `time`).
// Comparing as numbers avoids "…:00Z" vs "…:00.000Z" string differences.
function findHourAt<T extends { time: string }>(forecast: T[], timestamp: number): T | undefined {
  const hourStart = Math.floor(timestamp / MS_PER_HOUR) * MS_PER_HOUR;
  return forecast.find((hour) => Date.parse(hour.time) === hourStart);
}

// Owns the conditions data for the page: the form reports a zip code up,
// and results (the tide chart, later swell and wind) render below it.
function ConditionsReport() {
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Spots near the searched zip, when there are any. Otherwise `response` holds the zip-based
  // conditions (the fallback for zips with no spots defined yet).
  const [spotsResponse, setSpotsResponse] = useState<SpotsResponse | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  // Conditions for the selected spot, once loaded.
  const [spotConditions, setSpotConditions] = useState<SpotConditionsResponse | null>(null);
  const [isSpotLoading, setIsSpotLoading] = useState(false);
  // The spot whose conditions we're waiting for. If the user clicks another spot before the first
  // request finishes, the first answer must be ignored, or it could overwrite the second.
  // A ref (not state) because changing it shouldn't re-render anything; it's only read in handlers.
  const latestSpotRequest = useRef<string | null>(null);
  const [response, setResponse] = useState<ConditionsResponse | null>(null);
  // The time under the cursor on the tide chart (ms since 1970), or null when not hovering.
  // It lives here, in the parent, because siblings use it: TideChart sets it; StationMap and
  // SwellForecastCaption read it.
  // This is called "lifting state up".
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  // When the response arrived, used as "now" for the current-hour wind. Rendering must be pure
  // (same state in, same output), so Date.now() is called here in the event handler, not during render.
  const [loadedAt, setLoadedAt] = useState(0);

  async function handleZipCodeSubmit(zipCode: string) {
    setErrorMessage("");
    setHoveredTime(null);
    setSelectedSpotId(null);
    setSpotConditions(null);
    setIsSpotLoading(false);
    latestSpotRequest.current = null;

    setIsLoading(true);
    try {
      const spots = await getSpots(zipCode);
      if (spots.status === 'ok' && spots.spots.length > 0) {
        // Spots nearby: show them and let the user pick one.
        setSpotsResponse(spots);
        setResponse(null);
      } else {
        // Unknown zip, or no spots defined near it yet: fall back to the zip-based report,
        // which also produces the "Unknown zip code" message.
        setSpotsResponse(null);
        setResponse(await getConditions(zipCode));
        setLoadedAt(Date.now());
      }
    } catch (error) {
      console.error(error);
      setSpotsResponse(null);
      setResponse(null);
      setErrorMessage("Error loading conditions");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSpotSelect(spotId: string) {
    if (spotId === selectedSpotId) {
      return; // already showing (or loading) this spot
    }
    setSelectedSpotId(spotId);
    setHoveredTime(null);
    setErrorMessage("");
    setIsSpotLoading(true);
    latestSpotRequest.current = spotId;

    try {
      const conditions = await getSpotConditions(spotId);
      if (latestSpotRequest.current !== spotId) {
        return; // the user picked another spot meanwhile; that request will set the state
      }
      setSpotConditions(conditions);
      setLoadedAt(Date.now());
    } catch (error) {
      if (latestSpotRequest.current !== spotId) {
        return;
      }
      console.error(error);
      setSpotConditions(null);
      setErrorMessage("Error loading conditions for this spot");
    } finally {
      if (latestSpotRequest.current === spotId) {
        setIsSpotLoading(false);
      }
    }
  }

  // Decide what to show under the form. `station` is only set when status
  // is 'ok', so checking it also narrows away the null for TypeScript.
  let result = null;
  if (spotsResponse?.zipLocation) {
    const selectedSpot = spotsResponse.spots.find((spot) => spot.id === selectedSpotId);
    // Only use conditions that belong to the selected spot (not the previous one while the next loads).
    const conditions = spotConditions && spotConditions.spot.id === selectedSpotId ? spotConditions : null;
    // Times are shown in the tide station's zone; without a station, fall back to the browser's.
    const timeZone = conditions?.station?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const displayTime = hoveredTime ?? loadedAt;
    const wind = conditions ? findHourAt(conditions.windForecast, displayTime) : undefined;
    const swellForecast = conditions ? findHourAt(conditions.swellForecast, displayTime) : undefined;
    const rating = conditions ? findHourAt(conditions.ratings, displayTime) : undefined;

    let subtitle = "Select a spot to see its conditions";
    if (selectedSpot) {
      const details = `${selectedSpot.breakType} break, faces ${toCompass(selectedSpot.facingDeg)} (${selectedSpot.facingDeg}°)`;
      subtitle = isSpotLoading ? `${details} · loading conditions…` : details;
    }

    // Each slot below is always present (as an element or `false`), so adding the chart doesn't shift
    // the map's position among its siblings: React keeps the same map instead of rebuilding it.
    result = (
      <section className="card">
        <h2 className="station-name">{selectedSpot ? selectedSpot.name : `Surf spots near ${spotsResponse.zipCode}`}</h2>
        <p className="station-distance">{subtitle}</p>
        {conditions && conditions.tideLevels.length > 0 && (
          <TideChart
            tideLevels={conditions.tideLevels}
            timeZone={timeZone}
            onHoverTimeChange={setHoveredTime}
            ratingBands={toRatingBands(conditions.ratings)}
          />
        )}
        {conditions && <RatingCaption rating={rating} isCurrent={hoveredTime === null} timeZone={timeZone} />}
        {conditions && <SwellCaption buoy={conditions.buoy} reading={conditions.swell} timeZone={timeZone} />}
        <SpotsMap
          key={spotsResponse.zipCode}
          zipCode={spotsResponse.zipCode}
          zipLocation={spotsResponse.zipLocation}
          spots={spotsResponse.spots}
          selectedSpotId={selectedSpotId}
          onSelect={handleSpotSelect}
          wind={wind}
          isCurrentWind={hoveredTime === null}
          timeZone={timeZone}
        />
        {conditions && (
          <SwellForecastCaption forecast={swellForecast} isCurrent={hoveredTime === null} timeZone={timeZone} />
        )}
      </section>
    );
  } else if (response?.status === 'ok' && response.station && response.zipLocation) {
    const { station, stationDistanceMiles, zipLocation, zipCode } = response;
    // Not hovering: show the current hour, so the map and captions are useful without the mouse.
    const displayTime = hoveredTime ?? loadedAt;
    const wind = findHourAt(response.windForecast, displayTime);
    const swellForecast = findHourAt(response.swellForecast, displayTime);
    result = (
      <section className="card">
        <h2 className="station-name">{station.name}, {station.state}</h2>
        <p className="station-distance">{stationDistanceMiles} mi from {zipCode}</p>
        <TideChart tideLevels={response.tideLevels} timeZone={station.timeZone} onHoverTimeChange={setHoveredTime} />
        {/* The buoy's latest measurement sits with the chart; the hover-driven forecast stays under the map. */}
        <SwellCaption buoy={response.buoy} reading={response.swell} timeZone={station.timeZone} />
        {/* key: a new zip code remounts the map so it re-centers on the new points. */}
        <StationMap
          key={zipCode}
          zipCode={zipCode}
          zipLocation={zipLocation}
          stationName={station.name}
          stationLocation={{ lat: station.lat, lng: station.lng }}
          buoy={response.buoy}
          wind={wind}
          isCurrentWind={hoveredTime === null}
          timeZone={station.timeZone}
        />
        <SwellForecastCaption forecast={swellForecast} isCurrent={hoveredTime === null} timeZone={station.timeZone} />
      </section>
    );
  } else if (response) {
    result = <p className="card">{response.message}</p>;
  }

  return (
    <>
      <ZipCodeForm isLoading={isLoading} onSubmit={handleZipCodeSubmit} />
      {errorMessage && <p className="form-error">{errorMessage}</p>}
      {result}
    </>
  )
}

export default ConditionsReport
