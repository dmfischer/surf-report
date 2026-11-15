import type { Buoy, SwellReading } from "../types/conditions";

export interface SwellCaptionProps {
    buoy: Buoy | null;
    // The buoy's latest reading; null if it isn't reporting.
    reading: SwellReading | null;
    // IANA zone of the station, used to show the reading's time.
    timeZone: string;
}

// "3.6 ft @ 16.7 s from SW", leaving out whatever the buoy didn't report.
function describeWaves(heightFt: number | null, periodS: number | null, direction: string | null): string | null {
    if (heightFt === null) {
        return null;
    }
    const period = periodS === null ? "" : ` @ ${periodS} s`;
    const from = direction === null ? "" : ` from ${direction}`;
    return `${heightFt} ft${period}${from}`;
}

// One line under the map with the buoy's latest swell reading. Buoys measure, they don't forecast,
// so this shows current conditions only and doesn't follow the tide chart's hover.
function SwellCaption({ buoy, reading, timeZone }: SwellCaptionProps) {
    if (!buoy) {
        return <p className="swell-caption">No wave buoy within 50 miles</p>;
    }
    if (!reading) {
        return <p className="swell-caption">Swell at buoy {buoy.id}: no recent readings</p>;
    }

    const timeFormat = new Intl.DateTimeFormat("en-US", {
        timeZone, weekday: "short", hour: "numeric", minute: "2-digit",
    });
    const swell = describeWaves(reading.swellHeightFt, reading.swellPeriodS, reading.swellDirection);
    const windWaves = describeWaves(reading.windWaveHeightFt, reading.windWavePeriodS, reading.windWaveDirection);

    return (
        <p className="swell-caption" title={buoy.name}>
            Swell at buoy {buoy.id} (latest, {timeFormat.format(Date.parse(reading.time))}): {swell ?? "not reported"}
            {windWaves && <> · wind waves {windWaves}</>}
        </p>
    );
}

export default SwellCaption
