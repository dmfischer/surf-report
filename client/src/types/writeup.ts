// Shapes of the JSON returned by GET /api/writeup.
// Copied from server/src/model/writeup.ts and writeup-response.ts — keep in sync when the API changes.

// Part of a local day (server: model/week-summary.ts).
export type DayBlock = 'dawn' | 'morning' | 'afternoon' | 'evening'

// The weekly outlook for the region: the shape the LLM is asked to return.
export interface Writeup {
  headline: string
  days: WriteupDay[]
  caveats: string[]
}

export interface WriteupDay {
  // Local calendar date, "YYYY-MM-DD".
  date: string
  summary: string
  // Each one is a spot and block rated fair or good in the data the write-up was generated from.
  bestBets: { spotId: string; block: DayBlock }[]
}

// Either a write-up, or "nothing yet", told apart by `status` (a discriminated union).
export type WriteupResponse =
  | {
      status: 'ok'
      region: string
      // ISO 8601 UTC instant it was generated; shown so readers know how fresh it is.
      generatedAt: string
      writeup: Writeup
    }
  | {
      status: 'not_available'
      message: string
    }
