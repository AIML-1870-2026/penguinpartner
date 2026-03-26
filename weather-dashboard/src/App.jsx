import { useState, useEffect } from 'react';
import './App.css';
import SearchBar from './components/SearchBar.jsx';
import WeatherCard from './components/WeatherCard.jsx';
import UnitToggle from './components/UnitToggle.jsx';
import ErrorMessage from './components/ErrorMessage.jsx';
import { useWeather } from './hooks/useWeather.js';

export default function App() {
  const { weatherData, loading, error, fetchWeather } = useWeather();
  const [unit, setUnit] = useState(() => localStorage.getItem('weatherUnit') || 'C');

  useEffect(() => {
    localStorage.setItem('weatherUnit', unit);
  }, [unit]);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Weather Dashboard</h1>
        <UnitToggle unit={unit} onToggle={setUnit} />
      </header>

      <main className="app-main">
        <SearchBar onSearch={fetchWeather} loading={loading} />

        {loading && (
          <div className="loading-state" aria-live="polite" aria-label="Loading weather data">
            <div className="spinner" aria-hidden="true" />
            <p>Fetching weather...</p>
          </div>
        )}

        {error && !loading && <ErrorMessage message={error} />}

        {weatherData && !loading && !error && (
          <WeatherCard data={weatherData} unit={unit} />
        )}

        {!weatherData && !loading && !error && (
          <div className="empty-state" aria-label="No city searched yet">
            <p className="empty-icon" aria-hidden="true">🌤</p>
            <p>Search for a city to see the current weather.</p>
          </div>
        )}
      </main>
    </div>
  );
}
