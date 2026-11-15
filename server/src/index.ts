import express, { NextFunction, Request, Response } from "express";
import { getConditions } from "./service/noaa-conditions.service";
import { loadStations } from "./service/noaa-stations.service";
import { loadBuoys } from "./service/ndbc-buoys.service";

const app = express();
const PORT = 3001;

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/api/conditions/:zipCode", async (req: Request<{zipCode: string}>, res: Response) => {
    res.json(await getConditions(req.params.zipCode));
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
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});