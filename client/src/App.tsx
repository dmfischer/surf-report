import { useState, type SubmitEvent } from 'react';
import './App.css'

function App() {
  const [zipCode, setZipCode] = useState("");
  const [submittedZipCode, setSubmittedZipCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!zipCode.match(/^\d{5}$/)) {
      setErrorMessage("Zip Code Must Be 5 Digits");
      setSubmittedZipCode("");
      return;
    }

    if (submittedZipCode) {
      setErrorMessage("Zip Code Already Submitted");
      setSubmittedZipCode("");
    } else {
      setErrorMessage("");
      setSubmittedZipCode(zipCode);
    }
  }

  return (
    <main>
      <h1>Tide Chart</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="zip-code">Zip Code</label>
        <input id="zip-code" inputMode="numeric" value={zipCode}
          onChange={(event) => setZipCode(event.target.value)}></input>
        <button type="submit">Get tide chart</button>
      </form>
      {errorMessage && <p>{errorMessage}</p>}
      {submittedZipCode && <p>Chart for {submittedZipCode}</p>}
    </main>
  )
}

export default App
