import express, { Request, Response } from "express";
import { getConditions } from "./service/noaa-conditions.service";

const app = express();
const PORT = 3001;

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/conditions/:zipCode", async (req: Request<{zipCode: string}>, res: Response) => {
    res.json(await getConditions(req.params.zipCode));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});