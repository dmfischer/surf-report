import { DayBlock } from "./week-summary";

// The structured write-up: the shape the LLM is asked to return (as a JSON schema), so the server can
// check it field by field and the client can render it like any other data.
export interface Writeup {
    headline: string;
    days: WriteupDay[];
    caveats: string[];
}

export interface WriteupDay {
    date: string; // local "YYYY-MM-DD"
    summary: string;
    // Must each be a spot and block rated fair or good in the WeekSummary it was generated from.
    bestBets: { spotId: string; block: DayBlock }[];
}

// What's saved to disk (server/.cache/writeup.json) and served by GET /api/writeup.
export interface StoredWriteup {
    region: string;
    // ISO 8601 UTC instant the write-up was generated.
    generatedAt: string;
    writeup: Writeup;
}
