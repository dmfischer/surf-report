import { useState } from 'react';
import ZipCodeForm from './ZipCodeForm';
import { getConditions } from '../services/conditions.service';
import type { ConditionsResponse } from '../types/conditions';

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

  return (
    <>
      <ZipCodeForm isLoading={isLoading} onSubmit={handleZipCodeSubmit} />
      {errorMessage && <p>{errorMessage}</p>}
      {response && <p>Chart for {response.zipCode}</p>}
      {response && <pre>{JSON.stringify(response, null, 2)}</pre>}
    </>
  )
}

export default ConditionsReport
