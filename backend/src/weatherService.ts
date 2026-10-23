import "dotenv/config";
import { Coordinates, WeatherData } from "./types";

const baseUrl =
  process.env.WEATHER_API_BASE_URL ??
  "https://api.openweathermap.org/data/2.5";

const apiKey = process.env.WEATHER_API_KEY;

export async function getWeather(
  coords: Coordinates
): Promise<WeatherData> {
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
      timestamp: new Date().toISOString()
    };
  }

  const url =
    `${baseUrl}/weather?lat=${coords.latitude}` +
    `&lon=${coords.longitude}&appid=${apiKey}&units=metric`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    location: data.name ?? "Unknown",
    temperatureC: data.main?.temp ?? 0,
    humidity: data.main?.humidity ?? 0,
    precipitationProbability: 0,
    rainfallMm: data.rain?.["1h"] ?? 0,
    windSpeedKmh: (data.wind?.speed ?? 0) * 3.6,
    thunderstorm: data.weather?.some(
      (item: { id: number }) => item.id >= 200 && item.id < 300
    ) ?? false,
    floodWarning: false,
    heatWarning: (data.main?.temp ?? 0) >= 38,
    timestamp: new Date().toISOString()
  };
}
