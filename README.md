# Weather-Aware Travel Scheduling System

Starter project for a weather-aware travel scheduler.

## Features
- GPS starting location and city/place lookup
- Road-route distance and travel-time estimate
- Weather risk sampled at five points along the route for the selected departure
- Trip recommendation: Proceed / Reschedule / Cancel
- Local reminder scheduled one hour before departure
- On-device trip history and saved trips
- Dashboard with route-risk and recent-trip charts

## VS Code setup

### Backend
```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Linux/macOS:
```bash
cp .env.example .env
```

Add a valid OpenWeather API key to backend/.env:
```bash
WEATHER_API_KEY=your_real_openweather_key
```

The backend runs on http://localhost:3000. Real weather forecasts require an OpenWeather API key and are limited to its five-day forecast window. Without a key, the backend intentionally returns clearly labeled demo weather.

City search uses the Open-Meteo geocoding API. Driving routes use OSRM; if route lookup is unavailable, the app labels its straight-line-based distance and travel-time estimate instead of presenting it as a road route. Route weather is sampled at five points and uses the forecast time nearest the estimated arrival at each point.

### Mobile
```bash
cd mobile
npm install
npm start
```

Use the GPS button to read your current coordinates, or enter a destination as `latitude,longitude`.
Search by city and select a result, choose a future departure date and time, then analyze the trip. Analyzed trips are kept in device storage. Use “Save trip + 1-hour reminder” to save a trip and schedule its local notification.

For a physical phone, set `EXPO_PUBLIC_API_URL` to the backend's reachable LAN URL before starting Expo, for example `http://192.168.1.20:3000`. `localhost` and `10.0.2.2` are simulator defaults. GPS and local notifications require a native development build or app build; configure the backend URL to be reachable from that device.

The one-hour reminder is a local device notification (not push messaging) and requires notification permission.

## Next integrations
- GPS
- Google Calendar API
- Weather provider API
- Google Maps / route weather
- Firebase Cloud Messaging
- PostgreSQL
