import { useState } from 'react';

export default function SearchBar({ onSearch, loading }) {
  const [input, setInput] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    onSearch(input);
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit} role="search">
      <input
        type="text"
        className="search-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Search for a city..."
        aria-label="City name"
        disabled={loading}
        autoComplete="off"
      />
      <button
        type="submit"
        className="search-btn"
        aria-label="Search weather"
        disabled={loading || !input.trim()}
      >
        {loading ? <span className="btn-spinner" aria-hidden="true" /> : 'Search'}
      </button>
    </form>
  );
}
