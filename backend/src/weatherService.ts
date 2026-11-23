import "dotenv/config";
import { Coordinates, WeatherData } from "./types";

const baseUrl =
  process.env.WEATHER_API_BASE_URL ??
  "https://api.openweathermap.org/data/2.5";

const apiKey = process.env.WEATHER_API_KEY;

interface WeatherCondition {
  id: number;
  main?: string;
}

interface WeatherSnapshot {
  name?: string;
  main?: { temp?: number; humidity?: number };
  wind?: { speed?: number };
  weather?: WeatherCondition[];
  rain?: Record<string, number>;
  clouds?: { all?: number };
}

interface ForecastEntry extends WeatherSnapshot {
  dt?: number;
  pop?: number;
}

interface ForecastResponse {
  list?: ForecastEntry[];
  city?: { name?: string };
}

export function validateCoordinates(coords: Coordinates): boolean {
  return (
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude) &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
}

function normalizeWeatherData(
  current: WeatherSnapshot,
  forecast: ForecastResponse,
  forecastAt: Date
): WeatherData {
  const forecastEntries = forecast.list ?? [];
  const selectedForecast = forecastEntries.reduce<ForecastEntry | undefined>(
    (closest, entry) => {
      if (!entry.dt) return closest;
      if (!closest?.dt) return entry;
      return Math.abs(entry.dt * 1000 - forecastAt.getTime()) <
        Math.abs(closest.dt * 1000 - forecastAt.getTime())
        ? entry
        : closest;
    },
    undefined
  );
  const currentWeather = selectedForecast ?? current;
  const rainfallMm = Number(
    currentWeather.rain?.["3h"] ?? currentWeather.rain?.["1h"] ?? 0
  );
  const forecastTime = selectedForecast?.dt
    ? new Date(selectedForecast.dt * 1000)
    : forecastAt;
  return {
    location: current.name ?? forecast.city?.name ?? "Unknown",
    temperatureC: Number(currentWeather.main?.temp ?? current.main?.temp ?? 0),
    humidity: Number(currentWeather.main?.humidity ?? current.main?.humidity ?? 0),
    precipitationProbability: selectedForecast
      ? Number(selectedForecast.pop ?? 0) * 100
      : rainfallMm > 0
        ? 75
        : Math.min(60, Number(current.clouds?.all ?? 0)),
    rainfallMm,
    windSpeedKmh: Number((currentWeather.wind?.speed ?? current.wind?.speed ?? 0) * 3.6),
    thunderstorm: currentWeather.weather?.some(
      (item) => item.id >= 200 && item.id < 300
    ) ?? false,
    floodWarning: false,
    heatWarning: Number(currentWeather.main?.temp ?? current.main?.temp ?? 0) >= 38,
    timestamp: new Date().toISOString(),
    forecastFor: forecastTime.toISOString(),
    source: "OPENWEATHER"
  };
}

export async function getWeather(
  coords: Coordinates,
  forecastAt = new Date()
): Promise<WeatherData> {
  if (!validateCoordinates(coords)) {
    throw new Error("Invalid coordinates provided.");
  }

  if (!apiKey || apiKey === "your_api_key_here") {
    return {
      location: "Demo location",
      temperatureC: 31,
      humidity: 75,
      precipitationProbability: 80,
      rainfallMm: 12,
      windSpeedKmh: 25,
      thunderstorm: true,
      floodWarning: false,
      heatWarning: false,
      timestamp: new Date().toISOString(),
      forecastFor: forecastAt.toISOString(),
      source: "DEMO"
    };
  }

  const currentUrl =
    `${baseUrl}/weather?lat=${coords.latitude}` +
    `&lon=${coords.longitude}&appid=${apiKey}&units=metric`;

  const forecastUrl =
    `${baseUrl}/forecast?lat=${coords.latitude}` +
    `&lon=${coords.longitude}&appid=${apiKey}&units=metric&cnt=40`;

  const [weatherResponse, forecastResponse] = await Promise.all([
    fetch(currentUrl, { signal: AbortSignal.timeout(10000) }),
    fetch(forecastUrl, { signal: AbortSignal.timeout(10000) })
  ]);

  if (!weatherResponse.ok || !forecastResponse.ok) {
    const failingResponse = !weatherResponse.ok ? weatherResponse : forecastResponse;
    throw new Error(
      `Weather API error: ${failingResponse.status}`
    );
  }

  const [weatherData, forecastData] = await Promise.all([
    weatherResponse.json() as Promise<WeatherSnapshot>,
    forecastResponse.json() as Promise<ForecastResponse>
  ]);

  return normalizeWeatherData(weatherData, forecastData, forecastAt);
}
