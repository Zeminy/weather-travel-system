import "dotenv/config";
import express from "express";
import cors from "cors";
import { getWeather } from "./weatherService";
import { analyzeTrip } from "./riskEngine";
import { Coordinates } from "./types";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "weather-travel-backend" });
});

app.post("/api/analyze-trip", async (req, res) => {
  try {
    const { origin, destination } = req.body as {
      origin: Coordinates;
      destination: Coordinates;
    };

    if (!origin || !destination) {
      return res.status(400).json({
        error: "origin and destination are required"
      });
    }

    const [originWeather, destinationWeather] = await Promise.all([
      getWeather(origin),
      getWeather(destination)
    ]);

    res.json(analyzeTrip(originWeather, destinationWeather));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to analyze trip" });
  }
});

app.listen(port, () => {
  console.log(`Weather backend running at http://localhost:${port}`);
});
