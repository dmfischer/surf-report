import type { WriteupResponse } from "../types/writeup";

// The stored weekly outlook. The server only returns what it has saved, so this never costs a model call.
export async function getWriteup(): Promise<WriteupResponse> {
    const response = await fetch("/api/writeup");

    if (response.ok) {
        return (await response.json()) as WriteupResponse;
    }

    throw new Error(`Write-up request failed: ${response.status}`);
}
