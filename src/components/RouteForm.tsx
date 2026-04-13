import React, { useState } from 'react';
import { MapPin, Navigation, Clock, FastForward, Plus, Trash2 } from 'lucide-react';
import AutocompleteInput from './AutocompleteInput';

interface RouteFormProps {
  onCalculate: (origin: string, dest: string, speed: number, time: string, waypoints: string[]) => void;
  isLoading: boolean;
  origin: string;
  setOrigin: (val: string) => void;
  destination: string;
  setDestination: (val: string) => void;
  speed: number;
  setSpeed: (val: number) => void;
  time: string;
  setTime: (val: string) => void;
  waypoints: string[];
  setWaypoints: (val: string[]) => void;
}

export default function RouteForm({ 
  onCalculate, 
  isLoading,
  origin,
  setOrigin,
  destination,
  setDestination,
  speed,
  setSpeed,
  time,
  setTime,
  waypoints,
  setWaypoints
}: RouteFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCalculate(origin, destination, speed, time, waypoints);
  };

  const addWaypoint = () => setWaypoints([...waypoints, '']);
  const updateWaypoint = (idx: number, val: string) => {
    const next = [...waypoints];
    next[idx] = val;
    setWaypoints(next);
  };
  const removeWaypoint = (idx: number) => setWaypoints(waypoints.filter((_, i) => i !== idx));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="relative">
          <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Origin</label>
          <AutocompleteInput
            value={origin}
            onChange={setOrigin}
            placeholder="Start location"
            icon={<MapPin className="w-4 h-4 text-gray-400" />}
            required
          />
        </div>

        {waypoints.map((wp, idx) => (
          <div key={idx} className="relative">
            <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Waypoint {idx + 1}</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <AutocompleteInput
                  value={wp}
                  onChange={(val) => updateWaypoint(idx, val)}
                  placeholder="Via location"
                  icon={<Navigation className="w-4 h-4 text-gray-400" />}
                />
              </div>
              <button 
                type="button"
                onClick={() => removeWaypoint(idx)}
                className="p-3 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        <button 
          type="button" 
          onClick={addWaypoint}
          className="text-xs font-semibold text-blue-600 flex items-center gap-1 hover:text-blue-700 transition-colors"
        >
          <Plus className="w-3 h-3" /> Add Waypoint
        </button>

        <div className="relative">
          <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Destination</label>
          <AutocompleteInput
            value={destination}
            onChange={setDestination}
            placeholder="End location"
            icon={<Navigation className="w-4 h-4 text-gray-400" />}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1.6fr] gap-4">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Avg Speed (MPH)</label>
          <div className="relative">
            <FastForward className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="number"
              value={speed}
              onChange={(e) => setSpeed(parseInt(e.target.value))}
              className="w-full pl-9 pr-2 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all text-sm"
              required
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 flex items-center justify-between">
            <span>Departure</span>
            <button 
              type="button"
              onClick={() => {
                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                setTime(now.toISOString().slice(0, 16));
              }}
              className="text-[9px] text-blue-600 hover:underline font-bold"
            >
              SET TO NOW
            </button>
          </label>
          <div className="relative group">
            <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="datetime-local"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full pl-8 pr-2 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all text-xs cursor-pointer hover:bg-gray-100"
              required
            />
          </div>
          <p className="text-[9px] text-gray-400 mt-1 italic">14-day forecast limit</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-[2] py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-blue-200"
        >
          {isLoading ? 'Calculating Route...' : 'Analyze Travel Weather'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOrigin('');
            setDestination('');
            setWaypoints([]);
          }}
          className="flex-1 py-4 bg-gray-50 text-gray-500 font-semibold rounded-xl hover:bg-gray-100 transition-all border border-gray-100"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
