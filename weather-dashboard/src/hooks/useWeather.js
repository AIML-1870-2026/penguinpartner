import { useState } from 'react';

const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

export function useWeather() {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function fetchWeather(city) {
    if (!city.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${BASE_URL}?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`
      );

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('City not found. Please check the spelling and try again.');
        }
        throw new Error(`Request failed (${res.status}). Please try again.`);
      }

      const data = await res.json();
      setWeatherData(data);
    } catch (err) {
      if (err.name === 'TypeError') {
        setError('Network error. Please check your internet connection.');
      } else {
        setError(err.message);
      }
      setWeatherData(null);
    } finally {
      setLoading(false);
    }
  }

  return { weatherData, loading, error, fetchWeather };
}
