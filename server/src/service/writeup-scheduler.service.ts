import { REGION } from "../data/region";
import { SPOTS } from "../data/spots";
import { isStale, nextScheduledTime } from "../util/writeup-schedule";
import { summarizeWeek } from "../util/week-summary";
import { getSpotConditions } from "./spot-conditions.service";
import { generateWriteup } from "./writeup.service";
import { loadWriteup, saveWriteup } from "./writeup-store.service";

// Off unless WRITEUP_ENABLED=true is set. Generating calls a paid LLM API, and `tsx watch` restarts the
// server on every save, so the safe default is to never call it unless you've asked for it.
export function isWriteupEnabled(): boolean {
    return process.env.WRITEUP_ENABLED === "true";
}

// True while a run is in progress, so a refresh that comes due meanwhile is skipped, not run twice.
let running = false;

// Fetches every spot's conditions, asks for a write-up and saves it. Never throws: on failure the
// previous saved copy (if any) stays in place and the next scheduled run tries again.
export async function runWriteup(): Promise<void> {
    if (running) {
        console.log("Write-up generation is already running; skipping this run");
        return;
    }
    running = true;
    try {
        // Each response degrades on its own (services return [] or null), so one source being down
        // gives a thinner summary rather than no write-up.
        const conditions = await Promise.all(SPOTS.map((spot) => getSpotConditions(spot)));
        const summary = summarizeWeek(conditions, new Date());
        const writeup = await generateWriteup(summary);
        if (!writeup) {
            console.error("Write-up generation returned nothing; keeping the previous copy");
            return;
        }
        // Stamped when generation finishes, so it's never before the scheduled time that started it.
        const generatedAt = new Date().toISOString();
        if (await saveWriteup({ region: REGION.name, generatedAt, writeup })) {
            console.log(`Write-up generated at ${generatedAt}`);
        }
    } catch (err) {
        console.error("Write-up generation failed:", err);
    } finally {
        // `finally` runs after return and catch too, so the flag can't get stuck on.
        running = false;
    }
}

// Called once at startup, after listen(). Generates now if the saved copy is missing or missed a
// refresh, then runs at each scheduled time (4 am, 12 pm, 8 pm local).
export async function startWriteupScheduler(): Promise<void> {
    if (!isWriteupEnabled()) {
        console.log("Write-up generation is off (set WRITEUP_ENABLED=true to turn it on)");
        return;
    }
    try {
        const stored = await loadWriteup();
        if (isStale(stored, new Date(), REGION.timeZone)) {
            await runWriteup();
        }
    } catch (err) {
        // loadWriteup shouldn't throw, but if it does, still schedule the future runs.
        console.error("Write-up startup check failed:", err);
    }
    scheduleNextRun(new Date());
}

function scheduleNextRun(from: Date): void {
    // Work out the next time fresh each run instead of using setInterval(8 hours): the gap isn't
    // always 8 hours of real time (daylight-saving days have 7 or 9), and this keeps 4 am at 4 am.
    const next = nextScheduledTime(from, REGION.timeZone);
    const timer = setTimeout(async () => {
        await runWriteup();
        // Timers can fire a millisecond early; computing from `next` (not now) avoids picking the same
        // time again and running twice.
        scheduleNextRun(new Date(Math.max(Date.now(), next.getTime())));
    }, next.getTime() - Date.now());
    // unref() lets the process exit (tests, Ctrl+C) without waiting hours for this timer.
    timer.unref();
}
