# Weather-Aware Travel Scheduling System

Starter project for a weather-aware travel scheduler.

## Features
- Current location + destination weather comparison
- Weather risk scoring
- Trip recommendation: Proceed / Reschedule / Cancel
- One-hour-before-departure notification logic
- Suggested safer time slots
- Mobile starter UI

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

The backend runs on http://localhost:3000.

### Mobile
```bash
cd mobile
npm install
npm start
```

## Next integrations
- GPS
- Google Calendar API
- Weather provider API
- Google Maps / route weather
- Firebase Cloud Messaging
- PostgreSQL
