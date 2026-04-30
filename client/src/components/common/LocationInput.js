import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * LocationInput - Smart location field using the free CountriesNow API.
 * Supports country, state/province, and city dropdowns with type-ahead filtering.
 */
export function CountrySelect({ value, onChange, style, className }) {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('https://countriesnow.space/api/v0.1/countries/positions')
      .then(r => r.json())
      .then(data => {
        const names = (data.data || []).map(c => c.name).sort();
        setCountries(names);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <select
      className={className || 'form-select'}
      style={style}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={loading}
    >
      <option value="">{loading ? 'Loading...' : 'Select Country'}</option>
      {countries.map(c => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );
}

export function StateSelect({ country, value, onChange, style, className }) {
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!country) { setStates([]); return; }
    setLoading(true);
    fetch('https://countriesnow.space/api/v0.1/countries/states', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country }),
    })
      .then(r => r.json())
      .then(data => {
        const stateList = (data.data?.states || []).map(s => s.name).sort();
        setStates(stateList);
      })
      .catch(() => setStates([]))
      .finally(() => setLoading(false));
  }, [country]);

  return (
    <select
      className={className || 'form-select'}
      style={style}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={!country || loading}
    >
      <option value="">{loading ? 'Loading...' : (country ? 'Select State/Province' : 'Select Country first')}</option>
      {states.map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

export function CityInput({ country, state, value, onChange, style, className, placeholder }) {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const fetchCities = useCallback(() => {
    if (!country) return;
    setLoading(true);
    const body = state ? { country, state } : { country };
    const endpoint = state
      ? 'https://countriesnow.space/api/v0.1/countries/state/cities'
      : 'https://countriesnow.space/api/v0.1/countries/cities';

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(data => setCities((data.data || []).sort()))
      .catch(() => setCities([]))
      .finally(() => setLoading(false));
  }, [country, state]);

  useEffect(() => { fetchCities(); }, [fetchCities]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = cities.filter(c => c.toLowerCase().includes((value || '').toLowerCase())).slice(0, 12);

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        className={className || 'form-input'}
        style={style}
        value={value || ''}
        placeholder={loading ? 'Loading cities...' : (placeholder || 'City')}
        onChange={e => { onChange(e.target.value); setShowDropdown(true); }}
        onFocus={() => setShowDropdown(true)}
        autoComplete="off"
      />
      {showDropdown && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
          }}
        >
          {filtered.map(city => (
            <div
              key={city}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                color: 'var(--text-primary)', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              onMouseDown={() => { onChange(city); setShowDropdown(false); }}
            >
              {city}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * LocationBlock — A grouped Country/State/City picker for a single address object.
 * Props: value = { city, state, country }, onChange = (updatedField, value) => void
 */
export default function LocationBlock({ value = {}, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <CountrySelect
        value={value.country || ''}
        onChange={v => onChange('country', v)}
      />
      <StateSelect
        country={value.country}
        value={value.state || ''}
        onChange={v => onChange('state', v)}
      />
      <CityInput
        country={value.country}
        state={value.state}
        value={value.city || ''}
        onChange={v => onChange('city', v)}
        placeholder="City"
      />
    </div>
  );
}
