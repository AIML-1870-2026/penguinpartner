import { formatTemp, formatWindSpeed, formatVisibility, formatTime } from '../utils/conversions.js';

export default function WeatherCard({ data, unit }) {
  const { name, sys, weather, main, wind, visibility, timezone } = data;
  const condition = weather[0];
  const iconUrl = `https://openweathermap.org/img/wn/${condition.icon}@2x.png`;

  const sunrise = formatTime(sys.sunrise, timezone);
  const sunset = formatTime(sys.sunset, timezone);

  return (
    <article className="weather-card" aria-label={`Weather for ${name}, ${sys.country}`}>
      <div className="card-header">
        <div>
          <h2 className="city-name">{name}, {sys.country}</h2>
          <p className="condition-text">{condition.description}</p>
        </div>
        <img
          className="weather-icon"
          src={iconUrl}
          alt={condition.description}
          width="80"
          height="80"
        />
      </div>

      <div className="temp-display">
        <span className="main-temp">{formatTemp(main.temp, unit)}</span>
        <span className="feels-like">Feels like {formatTemp(main.feels_like, unit)}</span>
      </div>

      <div className="details-grid">
        <div className="detail-item">
          <span className="detail-label">Humidity</span>
          <span className="detail-value">{main.humidity}%</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Wind</span>
          <span className="detail-value">{formatWindSpeed(wind.speed, unit)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Visibility</span>
          <span className="detail-value">{formatVisibility(visibility, unit)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Pressure</span>
          <span className="detail-value">{main.pressure} hPa</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Sunrise</span>
          <span className="detail-value">{sunrise}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Sunset</span>
          <span className="detail-value">{sunset}</span>
        </div>
      </div>
    </article>
  );
}
