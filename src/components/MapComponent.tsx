import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Wind, ArrowUp } from 'lucide-react';
import { Location, RoutePoint } from '../types';

// Fix for default marker icons in Leaflet with React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const getCompassDirection = (deg: number) => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(deg / 45) % 8];
};

interface MapComponentProps {
  routePoints: RoutePoint[];
  routeGeometry?: any;
}

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export default function MapComponent({ routePoints, routeGeometry }: MapComponentProps) {
  const [center, setCenter] = useState<[number, number]>([39.8283, -98.5795]); // US Center
  const [zoom, setZoom] = useState(4);

  useEffect(() => {
    if (routePoints.length > 0) {
      const first = routePoints[0].location;
      setCenter([first.lat, first.lng]);
      setZoom(6);
    }
  }, [routePoints]);

  const polyline = routeGeometry ? routeGeometry.coordinates.map((c: any) => [c[1], c[0]]) : [];

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-sm border border-gray-200">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {polyline.length > 0 && <Polyline positions={polyline} color="#3b82f6" weight={4} opacity={0.7} />}
        
        {routePoints.map((point, idx) => (
          <Marker key={idx} position={[point.location.lat, point.location.lng]}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{point.location.name}</p>
                <p>{new Date(point.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                {point.weather ? (
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{Math.round(point.weather.temp)}°F</span>
                      <span className="text-gray-500">{point.weather.description}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <div className="flex items-center gap-1">
                        <Wind className="w-3 h-3" />
                        <span>{Math.round(point.weather.windSpeed)} mph</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ArrowUp 
                          className="w-3 h-3 text-blue-500" 
                          style={{ transform: `rotate(${point.weather.windDeg + 180}deg)` }} 
                        />
                        <span className="font-bold">{getCompassDirection(point.weather.windDeg)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-1 italic">No forecast available for this date</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        
        <ChangeView center={center} zoom={zoom} />
      </MapContainer>
    </div>
  );
}
