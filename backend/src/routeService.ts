import { Coordinates, RouteEstimate } from "./types";

const routerBaseUrl =
  process.env.ROUTING_API_BASE_URL ??
  "https://router.project-osrm.org/route/v1/driving";

interface OsrmResponse {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      coordinates?: number[][];
    };
  }>;
}

function distanceBetween(first: Coordinates, second: Coordinates): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (second.latitude - first.latitude) * radians;
  const longitudeDelta = (second.longitude - first.longitude) * radians;
  const firstLatitude = first.latitude * radians;
  const secondLatitude = second.latitude * radians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function samplePath(path: Coordinates[], sampleCount: number) {
  const segmentLengths = path.slice(1).map((point, index) =>
    distanceBetween(path[index], point)
  );
  const totalDistance = segmentLengths.reduce((total, length) => total + length, 0);

  if (totalDistance === 0) {
    return Array.from({ length: sampleCount }, (_, index) => ({
      coordinates: path[0],
      progress: index / Math.max(1, sampleCount - 1)
    }));
  }

  return Array.from({ length: sampleCount }, (_, index) => {
    const progress = index / Math.max(1, sampleCount - 1);
    const targetDistance = totalDistance * progress;
    let traversedDistance = 0;

    for (let segmentIndex = 0; segmentIndex < segmentLengths.length; segmentIndex += 1) {
      const segmentLength = segmentLengths[segmentIndex];
      if (targetDistance <= traversedDistance + segmentLength || segmentIndex === segmentLengths.length - 1) {
        const segmentProgress = segmentLength === 0
          ? 0
          : Math.min(1, (targetDistance - traversedDistance) / segmentLength);
        const start = path[segmentIndex];
        const end = path[segmentIndex + 1];

        return {
          coordinates: {
            latitude: start.latitude + (end.latitude - start.latitude) * segmentProgress,
            longitude: start.longitude + (end.longitude - start.longitude) * segmentProgress
          },
          progress
        };
      }
      traversedDistance += segmentLength;
    }

    return { coordinates: path[path.length - 1], progress };
  });
}

function buildEstimate(
  origin: Coordinates,
  destination: Coordinates,
  warning?: string
): RouteEstimate {
  const distanceKm = distanceBetween(origin, destination) * 1.25;

  return {
    distanceKm,
    durationMinutes: Math.max(1, (distanceKm / 40) * 60),
    source: "ESTIMATE",
    warning,
    points: samplePath([origin, destination], 5)
  };
}

export async function estimateRoute(
  origin: Coordinates,
  destination: Coordinates
): Promise<RouteEstimate> {
  const url =
    `${routerBaseUrl}/${origin.longitude},${origin.latitude};` +
    `${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      throw new Error(`Router returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as OsrmResponse;
    const route = data.routes?.[0];
    const rawCoordinates = route?.geometry?.coordinates;
    if (
      data.code !== "Ok" ||
      !route ||
      !Number.isFinite(route.distance) ||
      !Number.isFinite(route.duration) ||
      !rawCoordinates ||
      rawCoordinates.length < 2 ||
      rawCoordinates.some(
        (point) =>
          point.length < 2 ||
          !Number.isFinite(point[0]) ||
          !Number.isFinite(point[1]) ||
          point[0] < -180 ||
          point[0] > 180 ||
          point[1] < -90 ||
          point[1] > 90
      )
    ) {
      throw new Error("Router returned no usable route");
    }

    const path = rawCoordinates.map(([longitude, latitude]) => ({
      latitude,
      longitude
    }));

    return {
      distanceKm: route.distance! / 1000,
      durationMinutes: route.duration! / 60,
      source: "OSRM",
      points: samplePath(path, 5)
    };
  } catch (error) {
    const warning =
      "Road routing is unavailable. Showing a straight-line distance adjusted by 25%, estimated at 40 km/h.";
    console.warn(
      "Unable to retrieve road route; using an explicitly labeled estimate.",
      error
    );
    return buildEstimate(origin, destination, warning);
  }
}
