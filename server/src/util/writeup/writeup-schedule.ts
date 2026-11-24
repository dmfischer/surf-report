import { StoredWriteup } from "../../model/writeup";

// Local hours (in the region's time zone) at which the write-up is regenerated. Fixed times, rather
// than "every 8 hours", so restarts don't shift the schedule; 4 am has a fresh outlook ready for dawn.
export const REFRESH_HOURS = [4];

// The latest scheduled time at or before `now`. If now is exactly 12:00, that's 12:00 itself.
export function mostRecentScheduledTime(now: Date, timeZone: string, hours: number[] = REFRESH_HOURS): Date {
    // Yesterday is included because before 4 am the most recent refresh was yesterday's 8 pm.
    const candidates = scheduledTimesAround(now, timeZone, hours, [-1, 0]);
    const past = candidates.filter((time) => time.getTime() <= now.getTime());
    // `!`: with at least one hour, yesterday's times are always in the past, so this is never empty.
    return past[past.length - 1]!;
}

// The first scheduled time strictly after `now`. If now is exactly 12:00, that's 8 pm.
export function nextScheduledTime(now: Date, timeZone: string, hours: number[] = REFRESH_HOURS): Date {
    // Tomorrow is included because after 8 pm the next refresh is tomorrow's 4 am.
    const candidates = scheduledTimesAround(now, timeZone, hours, [0, 1]);
    // `!`: with at least one hour, tomorrow's times are always in the future, so one is always found.
    return candidates.find((time) => time.getTime() > now.getTime())!;
}

// A saved write-up is stale if there isn't one, or it was generated before the most recent refresh
// time (e.g. with refreshes at 4 am and 12 pm, after a restart at 1 pm a copy from 12:05 pm is fresh but
// one from 4:05 am missed the 12 pm refresh).
export function isStale(stored: StoredWriteup | null, now: Date, timeZone: string, hours: number[] = REFRESH_HOURS): boolean {
    if (!stored) {
        return true;
    }
    const generatedAt = Date.parse(stored.generatedAt);
    // An unparseable time (NaN) counts as stale, so a damaged file gets replaced.
    if (Number.isNaN(generatedAt)) {
        return true;
    }
    return generatedAt < mostRecentScheduledTime(now, timeZone, hours).getTime();
}

// Every scheduled instant on the given local days (offsets from today, e.g. -1 = yesterday), sorted.
function scheduledTimesAround(now: Date, timeZone: string, hours: number[], dayOffsets: number[]): Date[] {
    const today = wallClock(now, timeZone);
    const times: Date[] = [];
    for (const offset of dayOffsets) {
        // Date.UTC rolls over month and year ends for us (e.g. day 0 is the last day of the previous month).
        const day = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
        for (const hour of hours) {
            times.push(localTimeToInstant(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hour, timeZone));
        }
    }
    return times.sort((a, b) => a.getTime() - b.getTime());
}

// The instant when the zone's wall clock reads year-month-day hour:00, independent of the server's zone.
// Same approach as noaa-tides.service's station midnight.
function localTimeToInstant(year: number, month: number, day: number, hour: number, timeZone: string): Date {
    const localAsUtc = Date.UTC(year, month - 1, day, hour);
    // First pass guesses with the offset at that UTC instant; the second corrects it if the offset is
    // different a few hours later or earlier (a daylight-saving change in between).
    let instant = localAsUtc - offsetMs(new Date(localAsUtc), timeZone);
    instant = localAsUtc - offsetMs(new Date(instant), timeZone);
    return new Date(instant);
}

// The zone's UTC offset at an instant, e.g. -4h for EDT: local wall-clock time read as UTC, minus the instant.
function offsetMs(date: Date, timeZone: string): number {
    const local = wallClock(date, timeZone);
    const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
    return localAsUtc - Math.floor(date.getTime() / 60000) * 60000;
}

function wallClock(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
    return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour"), minute: part("minute") };
}
