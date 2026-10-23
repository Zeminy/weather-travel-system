import { RiskLevel, TripAnalysis, WeatherData } from "./types";

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

  return { score: Math.min(score, 100), reasons };
}

export function getRiskLevel(score: number): RiskLevel {
  if (score < 30) return "SAFE";
  if (score < 60) return "CAUTION";
  if (score < 80) return "HIGH";
  return "DANGEROUS";
}

export function analyzeTrip(
  origin: WeatherData,
  destination: WeatherData
): TripAnalysis {
  const originScore = scoreWeather(origin);
  const destinationScore = scoreWeather(destination);

  const riskScore = Math.min(
    100,
    Math.round(originScore.score * 0.35 + destinationScore.score * 0.65)
  );

  const riskLevel = getRiskLevel(riskScore);

  const recommendation =
    riskLevel === "DANGEROUS"
      ? "CANCEL"
      : riskLevel === "HIGH"
        ? "RESCHEDULE"
        : "PROCEED";

  return {
    riskScore,
    riskLevel,
    reasons: [...new Set([
      ...originScore.reasons,
      ...destinationScore.reasons
    ])],
    recommendation,
    originWeather: origin,
    destinationWeather: destination
  };
}
