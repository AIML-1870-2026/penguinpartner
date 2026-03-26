export function toFahrenheit(celsius) {
  return (celsius * 9) / 5 + 32;
}

export function formatTemp(celsius, unit) {
  const temp = unit === 'F' ? toFahrenheit(celsius) : celsius;
  return `${Math.round(temp)}°${unit}`;
}

export function formatWindSpeed(ms, unit) {
  if (unit === 'F') {
    return `${(ms * 2.237).toFixed(1)} mph`;
  }
  return `${ms.toFixed(1)} m/s`;
}

export function formatVisibility(meters, unit) {
  if (unit === 'F') {
    return `${(meters / 1609.344).toFixed(1)} mi`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatTime(unixTimestamp, timezoneOffset) {
  const date = new Date((unixTimestamp + timezoneOffset) * 1000);
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
