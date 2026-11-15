import { useState } from 'react';
import ZipCodeForm from './ZipCodeForm';
import { getConditions } from '../services/conditions.service';
import type { ConditionsResponse } from '../types/conditions';
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

    setIsLoading(true);
    try {
      setResponse(await getConditions(zipCode));
      setLoadedAt(Date.now());
    } catch (error) {
      console.error(error);
      setResponse(null);
      setErrorMessage("Error loading conditions");
    } finally {
      setIsLoading(false);
    }
  }

  // Decide what to show under the form. `station` is only set when status
  // is 'ok', so checking it also narrows away the null for TypeScript.
  let result = null;
  if (response?.status === 'ok' && response.station && response.zipLocation) {
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
