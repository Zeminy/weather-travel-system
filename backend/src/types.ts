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
  forecastFor: string;
  source: "OPENWEATHER" | "DEMO";
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

export interface SafeTimeWindow {
  start: string;
  end: string;
  label: string;
}

export interface RouteEstimate {
  distanceKm: number;
  durationMinutes: number;
  source: "OSRM" | "ESTIMATE";
  warning?: string;
  points: Array<{ coordinates: Coordinates; progress: number }>;
}

export interface RouteWeatherPoint {
  coordinates: Coordinates;
  progress: number;
  weather: WeatherData;
  riskScore: number;
}

export interface Place {
  name: string;
  region?: string;
  country?: string;
  coordinates: Coordinates;
}

export interface TripAnalysis {
  riskScore: number;
  riskLevel: RiskLevel;
  reasons: string[];
  recommendation: "PROCEED" | "RESCHEDULE" | "CANCEL";
  originWeather: WeatherData;
  destinationWeather: WeatherData;
  suggestedSafeWindows?: SafeTimeWindow[];
  departureAlert?: boolean;
  departureTime?: string;
  route?: RouteEstimate;
  routeWeather?: RouteWeatherPoint[];
}
