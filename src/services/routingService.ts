import { Location, RoutePoint } from '../types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export async function getRoute(origin: Location, destination: Location, waypoints: Location[] = []): Promise<any> {
  const coords = [origin, ...waypoints, destination]
    .map(loc => `${loc.lng},${loc.lat}`)
    .join(';');

  // 1. Try Mapbox if token is available (Most reliable)
  if (MAPBOX_TOKEN && MAPBOX_TOKEN.length > 10) {
    try {
      const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?overview=full&geometries=geojson&steps=true&access_token=${MAPBOX_TOKEN}`);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.warn("Mapbox Routing failed, falling back to OSRM:", error);
    }
  }

  // 2. Try Primary OSRM
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`);
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    throw new Error(`OSRM Primary failed with status: ${response.status}`);
  } catch (error) {
    console.warn("OSRM Primary failed, trying fallback:", error);
    
    // 3. Try Fallback OSRM (OpenStreetMap.de)
    try {
      const response = await fetch(`https://routing.openstreetmap.de/routed-car/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (fallbackError) {
      console.error("All routing services failed:", fallbackError);
    }
  }

  return null;
}

export function calculateETAs(routeData: any, departureTime: number, averageSpeedMph: number, origin: Location, destination: Location, waypoints: Location[]): RoutePoint[] {
  if (!routeData || !routeData.routes || routeData.routes.length === 0) return [];

  const route = routeData.routes[0];
  const legs = route.legs;
  const allLocations = [origin, ...waypoints, destination];
  const points: RoutePoint[] = [];
  
  let currentEta = departureTime;

  legs.forEach((leg: any, index: number) => {
    // Add the starting point of this leg (User defined location)
    points.push({
      location: allLocations[index],
      eta: currentEta
    });

    // Sample intermediate points for this leg if it's long
    const legDistanceMiles = leg.distance / 1609.34;
    const legDurationMs = (legDistanceMiles / averageSpeedMph) * 60 * 60 * 1000;
    
    // Sample every ~100 miles within the leg for weather
    const intermediateCount = Math.floor(legDistanceMiles / 100);
    if (intermediateCount > 0 && leg.steps && leg.steps.length > 0) {
      // Flatten all coordinates in this leg
      const legCoords: [number, number][] = [];
      leg.steps.forEach((step: any) => {
        if (step.geometry && step.geometry.coordinates) {
          legCoords.push(...step.geometry.coordinates);
        }
      });

      if (legCoords.length > 0) {
        for (let i = 1; i <= intermediateCount; i++) {
          const fraction = i / (intermediateCount + 1);
          const coordIndex = Math.floor(fraction * (legCoords.length - 1));
          const coord = legCoords[coordIndex];
          const intermediateEta = currentEta + (legDurationMs * fraction);
          
          points.push({
            location: {
              name: `Point ${points.length}`,
              lat: coord[1],
              lng: coord[0]
            },
            eta: intermediateEta
          });
        }
      }
    }

    currentEta += legDurationMs;
  });

  // Add the final destination
  points.push({
    location: allLocations[allLocations.length - 1],
    eta: currentEta
  });

  return points;
}
