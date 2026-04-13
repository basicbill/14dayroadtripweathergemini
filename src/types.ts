export interface Location {
  name: string;
  lat: number;
  lng: number;
}

export interface WeatherSnapshot {
  timestamp: number;
  temp: number;
  condition: string;
  description: string;
  icon: string;
  windSpeed: number;
  precipProb: number;
}

export interface RoutePoint {
  location: Location;
  eta: number; // timestamp
  weather?: WeatherSnapshot;
}

export interface SavedRoute {
  id?: string;
  uid: string;
  name: string;
  origin: Location;
  destination: Location;
  waypoints: Location[];
  averageSpeed: number;
  departureTime: number; // timestamp
  createdAt: number;
}
