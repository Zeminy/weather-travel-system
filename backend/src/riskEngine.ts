import {
  RiskLevel,
  RouteWeatherPoint,
  SafeTimeWindow,
  TripAnalysis,
  WeatherData
} from "./types";

function scoreWeather(weather: WeatherData) {
  let score = 0;
  const reasons: string[] = [];

  if (weather.precipitationProbability >= 70) {
    score += 25;
    reasons.push("High probability of precipitation");
  }
  if (weather.rainfallMm >= 20) {
    score += 20;
    reasons.push("Heavy rainfall expected");
  }
  if (weather.thunderstorm) {
    score += 30;
    reasons.push("Thunderstorm risk");
  }
  if (weather.windSpeedKmh >= 50) {
    score += 20;
    reasons.push("Strong winds");
  }
  if (weather.floodWarning) {
    score += 40;
    reasons.push("Flood warning");
  }
  if (weather.heatWarning) {
    score += 20;
    reasons.push("Heat-health warning");
  }
  if (weather.humidity >= 80) {
    score += 10;
    reasons.push("Very humid conditions");
  }
  if (weather.temperatureC >= 35) {
    score += 15;
    reasons.push("Extreme heat expected");
  }
  if (weather.temperatureC <= 5) {
    score += 10;
    reasons.push("Cold conditions may affect travel");
  }

  return { score: Math.min(score, 100), reasons };
}

function buildSafeTimeWindows(riskScore: number): SafeTimeWindow[] {
  const windows: SafeTimeWindow[] = [
    { start: "06:00", end: "09:00", label: "Early morning" },
    { start: "10:00", end: "13:00", label: "Late morning" },
    { start: "14:00", end: "17:00", label: "Afternoon" },
    { start: "19:00", end: "21:00", label: "Evening" }
  ];

  if (riskScore >= 70) {
    return windows.slice(0, 2);
  }

  if (riskScore >= 40) {
    return windows.slice(0, 3);
  }

  return windows;
}

export function getRiskLevel(score: number): RiskLevel {
  if (score < 30) return "SAFE";
  if (score < 60) return "CAUTION";
  if (score < 80) return "HIGH";
  return "DANGEROUS";
}

function getRecommendation(
  score: number,
  weatherSamples: WeatherData[]
): "PROCEED" | "RESCHEDULE" | "CANCEL" {
  if (
    score >= 80 ||
    weatherSamples.some((weather) => weather.floodWarning || weather.thunderstorm)
  ) {
    return "CANCEL";
  }

  if (score >= 55) {
    return "RESCHEDULE";
  }

  return "PROCEED";
}

export function analyzeTrip(
  origin: WeatherData,
  destination: WeatherData,
  routeSamples: Array<Omit<RouteWeatherPoint, "riskScore">> = []
): TripAnalysis {
  const originScore = scoreWeather(origin);
  const destinationScore = scoreWeather(destination);
  const routeScores = routeSamples.map((sample) =>
    scoreWeather(sample.weather)
  );
  const samples = routeSamples;

  const riskScore = samples.length
    ? Math.max(...routeScores.map((score) => score.score))
    : Math.min(
        100,
        Math.round(originScore.score * 0.35 + destinationScore.score * 0.65)
      );

  const riskLevel = getRiskLevel(riskScore);
  const reasons = [...new Set([
    ...originScore.reasons,
    ...destinationScore.reasons,
    ...routeScores.flatMap((score) => score.reasons)
  ])];

  const weatherSamples = samples.length
    ? samples.map((sample) => sample.weather)
    : [origin, destination];
  const recommendation = getRecommendation(riskScore, weatherSamples);

  return {
    riskScore,
    riskLevel,
    reasons,
    recommendation,
    originWeather: origin,
    destinationWeather: destination,
    suggestedSafeWindows: buildSafeTimeWindows(riskScore),
    departureAlert: riskLevel !== "SAFE" && reasons.length > 0,
    routeWeather: samples.map((sample, index) => ({
      ...sample,
      riskScore: routeScores[index].score
    }))
  };
}
