import { useState } from 'react';
import ZipCodeForm from './ZipCodeForm';
import { getConditions } from '../services/conditions.service';
import type { ConditionsResponse } from '../types/conditions';
import TideChart from './TideChart';
import StationMap from './StationMap';

// Owns the conditions data for the page: the form reports a zip code up,
// and results (the tide chart, later swell and wind) render below it.
function ConditionsReport() {
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<ConditionsResponse | null>(null);

  async function handleZipCodeSubmit(zipCode: string) {
    setErrorMessage("");

    setIsLoading(true);
    try {
      setResponse(await getConditions(zipCode));
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
    result = (
      <section className="card">
        <h2 className="station-name">{station.name}, {station.state}</h2>
        <p className="station-distance">{stationDistanceMiles} mi from {zipCode}</p>
        <TideChart tideLevels={response.tideLevels} timeZone={station.timeZone} />
        {/* key: a new zip code remounts the map so it re-centers on the new points. */}
        <StationMap
          key={zipCode}
          zipCode={zipCode}
          zipLocation={zipLocation}
          stationName={station.name}
          stationLocation={{ lat: station.lat, lng: station.lng }}
        />
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
