import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { StoredWriteup } from "../model/writeup";

// The latest write-up lives in server/.cache/writeup.json (gitignored), so restarts (e.g. every save
// under `tsx watch`) don't regenerate it. Resolved from this file, not the working directory.
export const WRITEUP_FILE_PATH = path.join(__dirname, "..", "..", ".cache", "writeup.json");

// ---------------------------------------------------------------------------------------------
// Reading: implemented on feature/writeup-endpoint.
// ---------------------------------------------------------------------------------------------

// PLACEHOLDER (contract only). Returns null if there's no saved write-up or it can't be read.
export async function loadWriteup(): Promise<StoredWriteup | null> {
    throw new Error("loadWriteup is not implemented yet");
}

// ---------------------------------------------------------------------------------------------
// Writing: implemented on feature/writeup-scheduler.
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
