import { useState, type SubmitEvent } from 'react';

interface ZipCodeFormProps {
  // Called with a validated 5-digit zip code when the form is submitted.
  onSubmit: (zipCode: string) => void;
  isLoading: boolean;
}

function ZipCodeForm({ isLoading, onSubmit }: ZipCodeFormProps) {
  const [zipCode, setZipCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!zipCode.match(/^\d{5}$/)) {
      setErrorMessage("Zip Code Must Be 5 Digits");
      return;
    }

    setErrorMessage("");
    onSubmit(zipCode);
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <label htmlFor="zip-code">Zip Code</label>
        <input id="zip-code" inputMode="numeric" value={zipCode}
          onChange={(event) => setZipCode(event.target.value)}></input>
        <button disabled={isLoading} type="submit">{isLoading ? 'Loading...' : 'Get tide chart'}</button>
      </form>
      {errorMessage && <p>{errorMessage}</p>}
    </>
  )
}

export default ZipCodeForm
