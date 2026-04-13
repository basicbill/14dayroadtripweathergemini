import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Suggestion {
  id: string;
  place_name: string;
  center: [number, number];
}

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  required?: boolean;
}

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

export default function AutocompleteInput({ 
  value, 
  onChange, 
  placeholder, 
  icon,
  required 
}: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (query: string) => {
    if (!query || query.length < 3 || !MAPBOX_TOKEN) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const resp = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5&types=place,address,locality`
      );
      const data = await resp.json();
      if (data.features) {
        setSuggestions(data.features.map((f: any) => ({
          id: f.id,
          place_name: f.place_name,
          center: f.center
        })));
        setIsOpen(true);
      }
    } catch (err) {
      console.error('Mapbox geocoding error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 400);
  };

  const handleSelect = (s: Suggestion) => {
    onChange(s.place_name);
    setIsOpen(false);
    setSuggestions([]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          ) : (
            icon || <Search className="w-4 h-4 text-gray-400" />
          )}
        </div>
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all text-sm"
          required={required}
          autoComplete="off"
        />
      </div>

      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden"
          >
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full px-4 py-3 text-left text-sm hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 flex items-start gap-3"
              >
                <Search className="w-3 h-3 text-gray-300 mt-1 shrink-0" />
                <span className="text-gray-700 line-clamp-2">{s.place_name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
