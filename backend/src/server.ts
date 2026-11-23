import "dotenv/config";
import express from "express";
import cors from "cors";
import { getWeather, validateCoordinates } from "./weatherService";
import { analyzeTrip } from "./riskEngine";
import { Coordinates, Place } from "./types";
import { estimateRoute } from "./routeService";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "weather-travel-backend" });
});

app.get("/api/places", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (query.length < 2 || query.length > 100) {
    return res.status(400).json({
      error: "Search text must be between 2 and 100 characters"
    });
  }

  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!response.ok) {
      throw new Error(`Place search service returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      results?: Array<{
        name: string;
        latitude: number;
        longitude: number;
        admin1?: string;
        country?: string;
      }>;
    };
    const places: Place[] = (data.results ?? [])
      .filter((place) =>
        validateCoordinates({
          latitude: place.latitude,
          longitude: place.longitude
        })
      )
      .map((place) => ({
        name: place.name,
        region: place.admin1,
        country: place.country,
        coordinates: {
          latitude: place.latitude,
          longitude: place.longitude
        }
      }));

    return res.json({ places });
  } catch (error) {
    console.error("Place search failed", error);
    return res.status(502).json({ error: "Place search is temporarily unavailable" });
  }
});

function isValidCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { latitude?: unknown; longitude?: unknown };
  return (
    typeof candidate.latitude === "number" &&
    typeof candidate.longitude === "number" &&
    validateCoordinates({
      latitude: candidate.latitude,
      longitude: candidate.longitude
    })
  );
}

app.post("/api/analyze-trip", async (req, res) => {
  try {
    const { origin, destination, departureTime } = req.body as {
      origin?: unknown;
      destination?: unknown;
      departureTime?: unknown;
    };

    if (!isValidCoordinates(origin) || !isValidCoordinates(destination)) {
      return res.status(400).json({
        error: "origin and destination coordinates are required and must be valid latitude/longitude pairs"
      });
    }

    const departureMilliseconds =
      typeof departureTime === "string" ? Date.parse(departureTime) : NaN;
    if (
      !Number.isFinite(departureMilliseconds) ||
      departureMilliseconds <= Date.now()
    ) {
      return res.status(400).json({
        error: "departureTime must be a valid future date and time"
      });
    }
    const weatherApiKey = process.env.WEATHER_API_KEY;
    if (
      weatherApiKey &&
      weatherApiKey !== "your_api_key_here" &&
      departureMilliseconds > Date.now() + 5 * 24 * 60 * 60 * 1000
    ) {
      return res.status(400).json({
        error: "OpenWeather forecasts are available for up to five days ahead"
      });
    }

    const route = await estimateRoute(origin, destination);
    const routeWeather = await Promise.all(
      route.points.map(async (point) => ({
        ...point,
        weather: await getWeather(
          point.coordinates,
          new Date(
            departureMilliseconds + route.durationMinutes * point.progress * 60000
          )
        )
      }))
    );
    const analysis = analyzeTrip(
      routeWeather[0].weather,
      routeWeather[routeWeather.length - 1].weather,
      routeWeather
    );

    return res.json({
      ...analysis,
      route,
      departureTime: new Date(departureMilliseconds).toISOString()
    });
  } catch (error) {
    console.error(error);
    return res.status(502).json({
      error: error instanceof Error ? error.message : "Unable to analyze trip"
    });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Weather backend running at http://0.0.0.0:${port}`);
});