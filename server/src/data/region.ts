// The one region for now: every spot in data/spots.ts. When spots exist elsewhere, this becomes a
// data/regions.ts list (id, name, time zone) and each Spot gets a regionId (see docs/llm-weekly-writeup.md).
export const REGION = {
    name: "South County",
    // IANA zone used for the write-up's days, day blocks and refresh times (4 am / 12 pm / 8 pm).
    timeZone: "America/New_York",
} as const;
