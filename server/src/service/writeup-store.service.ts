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

// PLACEHOLDER (contract only). Returns false on failure (logged, not thrown).
export async function saveWriteup(stored: StoredWriteup): Promise<boolean> {
    throw new Error("saveWriteup is not implemented yet");
}
