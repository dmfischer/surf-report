// The one region for now: every spot in data/spots.ts. When spots exist elsewhere, this becomes a
// data/regions.ts list (id, name, time zone) and each Spot gets a regionId (see docs/llm-weekly-writeup.md).
export const REGION = {
    name: "South County",
    // IANA zone used for the write-up's days, day blocks and refresh time (REFRESH_HOURS, currently 4 am).
    timeZone: "America/New_York",
} as const;
