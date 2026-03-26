export default function UnitToggle({ unit, onToggle }) {
  return (
    <div className="unit-toggle" role="group" aria-label="Temperature unit">
      <button
        className={`unit-btn ${unit === 'C' ? 'active' : ''}`}
        onClick={() => onToggle('C')}
        aria-pressed={unit === 'C'}
        aria-label="Celsius"
      >
        °C
      </button>
      <button
        className={`unit-btn ${unit === 'F' ? 'active' : ''}`}
        onClick={() => onToggle('F')}
        aria-pressed={unit === 'F'}
        aria-label="Fahrenheit"
      >
        °F
      </button>
    </div>
  );
}
