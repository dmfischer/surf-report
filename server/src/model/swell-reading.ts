// One wave measurement from an NDBC buoy, split into swell and wind waves. Heights are converted to
// feet from the buoy's metres. Any field is null when the buoy didn't report it for that reading.
export interface SwellReading {
    // ISO 8601 instant in UTC, e.g. "2026-11-15T20:26:00.000Z".
    time: string;
    // Significant wave height of all waves combined (the average of the highest third), not surf face height.
    waveHeightFt: number | null;
    // Long-period waves from distant storms: what makes surf.
    swellHeightFt: number | null;
    swellPeriodS: number | null;
    // 16-point compass direction the swell comes FROM, e.g. "SW". NDBC only gives compass points here.
    swellDirection: string | null;
    // Short-period chop made by local wind.
    windWaveHeightFt: number | null;
    windWavePeriodS: number | null;
    windWaveDirection: string | null;
    // NDBC's label: "SWELL" (clean), "AVERAGE", "STEEP" or "VERY_STEEP" (choppy).
    steepness: string | null;
}
