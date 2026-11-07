import { useState } from 'react';
import ZipCodeForm from './ZipCodeForm';

// Owns the conditions data for the page: the form reports a zip code up,
// and results (the tide chart, later swell and wind) render below it.
function ConditionsReport() {
  const [submittedZipCode, setSubmittedZipCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function handleZipCodeSubmit(zipCode: string) {
    setErrorMessage("");
    setSubmittedZipCode(zipCode);
  }

  return (
    <>
      <ZipCodeForm onSubmit={handleZipCodeSubmit} />
      {errorMessage && <p>{errorMessage}</p>}
      {submittedZipCode && <p>Chart for {submittedZipCode}</p>}
    </>
  )
}

export default ConditionsReport
