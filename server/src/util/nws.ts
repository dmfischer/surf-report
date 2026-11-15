// Helpers for parsing api.weather.gov (NWS) gridpoint data.
//
// Each gridpoint value has a `validTime` like "2026-11-15T02:00:00+00:00/PT3H":
// an ISO 8601 start time, a "/", then an ISO 8601 duration saying how long the value holds.
// NWS merges consecutive hours that share a value into one longer range, so these need
// expanding to one value per hour before different layers (speed, gust, direction) can be joined.

export interface NwsValidTime {
    start: Date;
    hours: number;
}

// One gridpoint layer: time ranges ("2026-11-15T02:00:00+00:00/PT1H"), each with a value (null = no value).
export interface NwsGridLayer {
    uom: string; // unit, e.g. "wmoUnit:km_h-1"
    values: { validTime: string; value: number | null }[];
}

const MS_PER_HOUR = 60 * 60 * 1000;

// Turns a layer's time ranges into one entry per hour, keyed by the hour's ISO UTC string
// ("2026-11-15T02:00:00.000Z"). A range of "PT3H" with value 12 becomes three entries of 12.
// Keying by the ISO string lets layers with different ranges be lined up hour by hour.
export function expandLayer(layer: NwsGridLayer): Map<string, number | null> {
    const hourly = new Map<string, number | null>();

    for (const entry of layer.values) {
        const { start, hours } = parseValidTime(entry.validTime);
        for (let i = 0; i < hours; i++) {
            const hour = new Date(start.getTime() + i * MS_PER_HOUR);
            hourly.set(hour.toISOString(), entry.value);
        }
    }

    return hourly;
}

// Splits "2026-11-15T02:00:00+00:00/PT3H" into its start instant and length in hours.
export function parseValidTime(validTime: string): NwsValidTime {
    const index = validTime.indexOf('/');
    if (index === -1) {
        throw new Error('Missing delimiter');
    }

    const startTime = new Date(validTime.substring(0, index));
    if (Number.isNaN(startTime.getTime())) {
        throw new Error(`Not a valid start time: ${startTime}`);
    }

    return {
        start: startTime,
        hours: parseDurationHours(validTime.substring(index + 1)),
    }
}

// Converts an ISO 8601 duration to whole hours. NWS uses days and hours only, e.g.:
//   "PT1H" -> 1    "PT13H" -> 13    "P1D" -> 24    "P1DT6H" -> 30    "P7D" -> 168
export function parseDurationHours(duration: string): number {
    let hours = 0;
    let num = '';

    for (const char of duration) {
        if (char <= '9' && char >= '0') {
            num = num + char;
            continue;
        }

        if (char === 'D' && num.length) {
            hours += (Number(num) * 24);
            num = '';
        }

        if (char === 'H' && num.length) {
            hours += Number(num);
            num = '';
        }

        if (num.length) {
            throw new Error(`bad duration: ${duration}`);
        }
    }

    if (hours === 0) {
        throw new Error(`bad duration: ${duration}`);
    }

    return hours;
}
