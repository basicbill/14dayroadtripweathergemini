import { WeatherSnapshot } from '../types';

const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;

async function fetchOpenMeteo(lat: number, lng: number, timestamp: number): Promise<WeatherSnapshot | null> {
  try {
    const targetDate = new Date(timestamp).toISOString().split('T')[0];
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weathercode,windspeed_10m,precipitation_probability&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=auto&start_date=${targetDate}&end_date=${targetDate}`
    );
    const data = await response.json();

    if (!data.hourly || !data.hourly.time) return null;

    const targetTimeStr = new Date(timestamp).toISOString().slice(0, 14) + "00";
    let closestIdx = 0;
    let minDiff = Infinity;

    data.hourly.time.forEach((time: string, idx: number) => {
      const diff = Math.abs(new Date(time).getTime() - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    // Map WMO codes to simple conditions
    const wmoCode = data.hourly.weathercode[closestIdx];
    let condition = "Clear";
    let description = "Clear sky";
    
    if (wmoCode >= 1 && wmoCode <= 3) { condition = "Clouds"; description = "Partly cloudy"; }
    else if (wmoCode >= 45 && wmoCode <= 48) { condition = "Fog"; description = "Foggy"; }
    else if (wmoCode >= 51 && wmoCode <= 67) { condition = "Rain"; description = "Rainy"; }
    else if (wmoCode >= 71 && wmoCode <= 77) { condition = "Snow"; description = "Snowy"; }
    else if (wmoCode >= 80 && wmoCode <= 82) { condition = "Rain"; description = "Showers"; }
    else if (wmoCode >= 95) { condition = "Thunderstorm"; description = "Thunderstorm"; }

    return {
      timestamp: new Date(data.hourly.time[closestIdx]).getTime(),
      temp: data.hourly.temperature_2m[closestIdx],
      condition,
      description,
      icon: "01d", // Placeholder
      windSpeed: data.hourly.windspeed_10m[closestIdx],
      precipProb: data.hourly.precipitation_probability[closestIdx]
    };
  } catch (error) {
    console.error("Open-Meteo fetch failed:", error);
    return null;
  }
}

export async function fetchWeather(lat: number, lng: number, timestamp: number): Promise<WeatherSnapshot | null> {
  const targetTime = timestamp / 1000;
  const now = Date.now() / 1000;
  const fiveDaysInSeconds = 5 * 24 * 60 * 60;
  const fourteenDaysInSeconds = 14 * 24 * 60 * 60;

  // Try OpenWeatherMap first if within 5 days and key exists
  if (targetTime <= now + fiveDaysInSeconds && targetTime >= now - 3600) {
    if (OPENWEATHER_API_KEY && OPENWEATHER_API_KEY !== "undefined" && OPENWEATHER_API_KEY.length > 5) {
      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=imperial`
        );
        const data = await response.json();
        
        if (response.status === 200 && data.list) {
          let closest = data.list[0];
          let minDiff = Math.abs(closest.dt - targetTime);

          for (const item of data.list) {
            const diff = Math.abs(item.dt - targetTime);
            if (diff < minDiff) {
              minDiff = diff;
              closest = item;
            }
          }

          return {
            timestamp: closest.dt * 1000,
            temp: closest.main.temp,
            condition: closest.weather[0].main,
            description: closest.weather[0].description,
            icon: closest.weather[0].icon,
            windSpeed: closest.wind.speed,
            precipProb: closest.pop * 100
          };
        }
      } catch (error) {
        console.error("OpenWeatherMap attempt failed, falling back to Open-Meteo");
      }
    }
  }

  // Fallback to Open-Meteo for extended dates or if OWM fails/is missing
  const fourteenDaysWithBuffer = fourteenDaysInSeconds + 3600; // 1 hour buffer
  if (targetTime <= now + fourteenDaysWithBuffer && targetTime >= now - 86400) {
    return fetchOpenMeteo(lat, lng, timestamp);
  }

  return null;
}
