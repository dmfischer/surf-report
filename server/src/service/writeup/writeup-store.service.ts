import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { StoredWriteup } from "../../model/writeup";
import { isStoredWriteup } from "../../util/writeup/writeup-shape";

// The latest write-up lives in server/.cache/writeup.json (gitignored), so restarts (e.g. every save
// under `tsx watch`) don't regenerate it. Resolved from this file, not the working directory.
export const WRITEUP_FILE_PATH = path.join(__dirname, "..", "..", "..", ".cache", "writeup.json");

// ---------------------------------------------------------------------------------------------
// Reading
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
// Writing
// ---------------------------------------------------------------------------------------------

// Returns false on failure (logged, not thrown).
export async function saveWriteup(stored: StoredWriteup): Promise<boolean> {
    // Write to a temporary file next to the real one, then rename it into place. A rename on the same
    // disk swaps the file in one step, so a crash mid-write (or a reader at the same moment) never
    // sees half a JSON file; at worst a stray .tmp file is left behind.
    const tempPath = `${WRITEUP_FILE_PATH}.tmp`;
    try {
        // The .cache folder is gitignored, so it doesn't exist in a fresh checkout.
        await mkdir(path.dirname(WRITEUP_FILE_PATH), { recursive: true });
        await writeFile(tempPath, JSON.stringify(stored, null, 2), "utf8");
        await rename(tempPath, WRITEUP_FILE_PATH);
        return true;
    } catch (err) {
        console.error(`Failed to save write-up to ${WRITEUP_FILE_PATH}:`, err);
        return false;
    }
}
