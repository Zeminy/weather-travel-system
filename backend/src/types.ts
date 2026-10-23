export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface WeatherData {
  location: string;
  temperatureC: number;
  humidity: number;
  precipitationProbability: number;
  rainfallMm: number;
  windSpeedKmh: number;
  thunderstorm: boolean;
  floodWarning: boolean;
  heatWarning: boolean;
  timestamp: string;
}

export type RiskLevel = "SAFE" | "CAUTION" | "HIGH" | "DANGEROUS";

export interface TravelEvent {
  id: string;
  title: string;
  origin: Coordinates;
  destination: Coordinates;
  departureTime: string;
  estimatedTravelMinutes: number;
}

export interface TripAnalysis {
  riskScore: number;
  riskLevel: RiskLevel;
  reasons: string[];
  recommendation: "PROCEED" | "RESCHEDULE" | "CANCEL";
  originWeather: WeatherData;
  destinationWeather: WeatherData;
}
