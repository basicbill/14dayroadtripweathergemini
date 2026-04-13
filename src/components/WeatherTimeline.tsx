import React from 'react';
import { RoutePoint } from '../types';
import { Cloud, Sun, CloudRain, Wind, Thermometer } from 'lucide-react';
import { motion } from 'motion/react';

interface WeatherTimelineProps {
  points: RoutePoint[];
}

export default function WeatherTimeline({ points }: WeatherTimelineProps) {
  if (points.length === 0) return null;

  return (
    <div className="w-full bg-white p-4 pb-6 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto custom-scrollbar">
      <div className="flex gap-6 min-w-max px-2">
        {points.map((point, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex flex-col items-center text-center w-24"
          >
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">
              {new Date(point.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-2 border border-gray-100">
              {point.weather ? (
                <WeatherIcon condition={point.weather.condition} />
              ) : (
                <div className="w-2 h-2 bg-gray-200 rounded-full animate-pulse" />
              )}
            </div>

            <span className="text-sm font-medium text-gray-900">
              {point.weather ? `${Math.round(point.weather.temp)}°` : '--'}
            </span>
            
            {point.weather && (
              <div className="flex items-center gap-1 mt-1">
                <Wind className="w-3 h-3 text-gray-400" />
                <span className="text-[9px] font-medium text-gray-500">
                  {Math.round(point.weather.windSpeed)} mph
                </span>
              </div>
            )}

            <span className="text-[10px] text-gray-500 truncate w-full mt-1">
              {point.location.name}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function WeatherIcon({ condition }: { condition: string }) {
  const cond = condition.toLowerCase();
  if (cond.includes('rain') || cond.includes('drizzle')) return <CloudRain className="w-6 h-6 text-blue-500" />;
  if (cond.includes('clear') || cond.includes('sun')) return <Sun className="w-6 h-6 text-yellow-500" />;
  if (cond.includes('wind')) return <Wind className="w-6 h-6 text-gray-500" />;
  return <Cloud className="w-6 h-6 text-gray-400" />;
}
