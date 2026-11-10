import { useState } from 'react';
import ZipCodeForm from './ZipCodeForm';
import { getConditions } from '../services/conditions.service';
import type { ConditionsResponse } from '../types/conditions';
import TideChart from './TideChart';

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
  if (response?.status === 'ok' && response.station) {
    const { station, stationDistanceMiles } = response;
    result = (
      <p>
        {station.name}, {station.state} ({stationDistanceMiles} mi away)
      </p>
    );
  } else if (response) {
    result = <p>{response.message}</p>;
  }

  return (
    <>
      <ZipCodeForm isLoading={isLoading} onSubmit={handleZipCodeSubmit} />
      {errorMessage && <p>{errorMessage}</p>}
      {result}
      {response && <TideChart tideLevels={response.tideLevels} />}
    </>
  )
}

export default ConditionsReport
