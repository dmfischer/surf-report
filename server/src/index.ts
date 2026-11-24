import express, { NextFunction, Request, Response } from "express";
import { getConditions } from "./service/noaa-conditions.service";
import { loadStations } from "./service/noaa-stations.service";
import { loadBuoys } from "./service/ndbc-buoys.service";
import { findSpotsNear, getSpot } from "./service/spots.service";
import { getSpotConditions } from "./service/spot-conditions.service";
import { startWriteupScheduler } from "./service/writeup-scheduler.service";

const app = express();
const PORT = 3001;

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/api/conditions/:zipCode", async (req: Request<{zipCode: string}>, res: Response) => {
    res.json(await getConditions(req.params.zipCode));
});

// GET /api/spots?zip=02882. The zip is a query parameter (not part of the path) because it filters
// the list of spots; /api/spots/:spotId will be one specific spot.
app.get("/api/spots", (req: Request, res: Response) => {
    const zip = req.query.zip;
    // Query values can be a string, an array (?zip=1&zip=2) or missing, so check before using it.
    if (typeof zip !== "string" || zip === "") {
        res.status(400).json({ error: "Missing zip query parameter, e.g. /api/spots?zip=02882" });
        return;
    }
    res.json(findSpotsNear(zip));
});

// GET /api/spots/narragansett-town-beach/conditions
app.get("/api/spots/:spotId/conditions", async (req: Request<{ spotId: string }>, res: Response) => {
    const spot = getSpot(req.params.spotId);
    // The spot is part of the URL path, so an unknown one is "not found" (404). That's unlike the zip
    // endpoints, where an unknown zip is a normal answer (200 with status "unknown_zip").
    if (!spot) {
        res.status(404).json({ error: `Unknown spot ${req.params.spotId}` });
        return;
    }
    res.json(await getSpotConditions(spot));
});

// Error-handling middleware (4 args) must be registered after the routes. Express 5 forwards
// rejected promises from async handlers here. Log the details, but don't leak them to the client.
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  // Load startup data before listen(), so no request can arrive before it's ready.
  // Both downloads are independent, so run them at the same time. loadBuoys never throws.
  await Promise.all([loadStations(), loadBuoys()]);

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Not awaited: generating the write-up takes a while and must never delay or break startup.
    // It doesn't throw, but the .catch is a safety net against an unhandled rejection.
    startWriteupScheduler().catch((err) => console.error("Write-up scheduler failed:", err));
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});