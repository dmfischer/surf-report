import { readFile } from "node:fs/promises";
import path from "node:path";
import { StoredWriteup } from "../model/writeup";
import { isStoredWriteup } from "../util/writeup-shape";

// The latest write-up lives in server/.cache/writeup.json (gitignored), so restarts (e.g. every save
// under `tsx watch`) don't regenerate it. Resolved from this file, not the working directory.
export const WRITEUP_FILE_PATH = path.join(__dirname, "..", "..", ".cache", "writeup.json");

// ---------------------------------------------------------------------------------------------
// Reading: implemented on feature/writeup-endpoint.
// ---------------------------------------------------------------------------------------------

// Returns the saved write-up, or null if there isn't one or it can't be read (never throws).
// Reads the file on every call, on purpose: it's tiny, and it keeps GET /api/writeup independent of
// the scheduler's in-memory state (whatever the scheduler last saved is what gets served).
export async function loadWriteup(): Promise<StoredWriteup | null> {
    let text: string;
    try {
        text = await readFile(WRITEUP_FILE_PATH, "utf8");
    } catch (err) {
        // No file yet is normal (first start, or generation hasn't succeeded), so don't log it.
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        console.error(`Could not read ${WRITEUP_FILE_PATH}:`, err);
        return null;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (err) {
        console.error(`${WRITEUP_FILE_PATH} is not valid JSON:`, err);
        return null;
    }

    if (!isStoredWriteup(parsed)) {
        console.error(`${WRITEUP_FILE_PATH} doesn't have the expected StoredWriteup shape; ignoring it`);
        return null;
    }
    return parsed;
}

// ---------------------------------------------------------------------------------------------
// Writing: implemented on feature/writeup-scheduler.
// ---------------------------------------------------------------------------------------------

// PLACEHOLDER (contract only). Returns false on failure (logged, not thrown).
export async function saveWriteup(stored: StoredWriteup): Promise<boolean> {
    throw new Error("saveWriteup is not implemented yet");
}
