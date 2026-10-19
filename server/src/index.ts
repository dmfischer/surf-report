import express, { Request, Response } from "express";
import { getConditions } from "./service/noaa-conditions.service";
import { loadStations } from "./service/noaa-stations.service";

const app = express();
const PORT = 3001;

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/conditions/:zipCode", async (req: Request<{zipCode: string}>, res: Response) => {
    res.json(await getConditions(req.params.zipCode));
});

async function start() {
  // Load startup data before listen(), so no request can arrive before it's ready.
  await loadStations();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});