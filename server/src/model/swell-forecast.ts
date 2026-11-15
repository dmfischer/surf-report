// One group of waves travelling together: a swell, or the local wind chop.
export interface WaveComponent {
    heightFt: number;
    periodS: number | null;
    // Direction the waves come FROM, in degrees: 0 = north, 90 = east.
    directionDeg: number | null;
}

// One hour of swell forecast (Open-Meteo marine model). Model output for the open water near the
// coast, not surf height at the beach. A component is null when the model has no value for it.
export interface SwellForecast {
    // ISO 8601 instant in UTC, e.g. "2026-11-15T08:00:00Z".
    time: string;
    // All waves combined (significant wave height).
    waveHeightFt: number | null;
    // The biggest swell, and the next one (often from a different storm and direction).
    primarySwell: WaveComponent | null;
    secondarySwell: WaveComponent | null;
    // Short-period chop made by local wind.
    windWaves: WaveComponent | null;
}
