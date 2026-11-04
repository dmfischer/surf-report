import { useState } from 'react';
import './App.css'

function App() {
  const [zipCode, setZipCode] = useState("");

  return (
    <main>
      <h1>Tide Chart</h1>
      <label htmlFor="zip-code">Zip Code</label>
      <input id="zip-code" inputMode="numeric" value={zipCode} 
        onChange={(event) => setZipCode(event.target.value)}></input>
    </main>
  )
}

export default App
