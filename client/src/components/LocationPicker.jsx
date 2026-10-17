import { useState } from 'react';
import toast from 'react-hot-toast';
import MapView from './MapView';
import Icon from './Icon';
import { Spinner } from './ui';
import { detectPosition } from '../context/LocationContext';
import { PRESET_LOCATIONS } from '../utils/constants';

const valid = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * Pick a location three ways: browser geolocation (only on click — that is when the browser asks permission),
 * a city preset, or by clicking the map / typing coordinates. value/onChange use { lat, lng, label }.
 */
export default function LocationPicker({ value, onChange, height = 'h-56', showPrivacyNote = true }) {
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const set = (lat, lng, label) => onChange({ lat: Number(lat), lng: Number(lng), label });

  const useMine = async () => {
    setBusy(true);
    try {
      const p = await detectPosition();
      set(p.lat, p.lng, 'My current location');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const pickPreset = (e) => {
    const p = PRESET_LOCATIONS.find((x) => x.label === e.target.value);
    if (p) set(p.lat, p.lng, p.label);
  };

  const has = value && valid(value.lat, value.lng);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={useMine} disabled={busy}>
          {busy ? <Spinner className="h-4 w-4" /> : <Icon name="locate" className="h-4 w-4" />} Use my location
        </button>
        <label className="sr-only" htmlFor="preset-city">Choose a city</label>
        <select id="preset-city" className="input !w-auto !py-1.5 text-xs" value="" onChange={pickPreset}>
          <option value="" disabled>…or choose a city</option>
          {PRESET_LOCATIONS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
        </select>
        <button type="button" className="text-xs font-semibold text-brand-700 underline" onClick={() => setManual((m) => !m)}>{manual ? 'Hide coordinates' : 'Enter coordinates'}</button>
      </div>
      {manual && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="lp-lat">Latitude</label>
            <input id="lp-lat" type="number" step="any" className="input" value={has ? value.lat : ''} onChange={(e) => set(e.target.value, value?.lng ?? 0, 'Custom location')} />
          </div>
          <div>
            <label className="label" htmlFor="lp-lng">Longitude</label>
            <input id="lp-lng" type="number" step="any" className="input" value={has ? value.lng : ''} onChange={(e) => set(value?.lat ?? 0, e.target.value, 'Custom location')} />
          </div>
        </div>
      )}
      <MapView
        className={height}
        zoom={has ? 13 : 5}
        center={has ? value : { lat: 22.5, lng: 79 }}
        markers={has ? [{ id: 'pick', lat: value.lat, lng: value.lng, color: '#1f6c5a' }] : []}
        onPick={(p) => set(p.lat, p.lng, 'Pinned on map')}
        draggablePin={(p) => set(p.lat, p.lng, 'Pinned on map')}
      />
      <p className="text-xs text-stone-500">
        {has ? <>Selected: <strong>{value.label || 'Pinned location'}</strong>. </> : 'Click the map to drop a pin. '}
        {showPrivacyNote && 'For your privacy, locations are rounded to roughly 1 km — your exact address is never shown publicly.'}
      </p>
    </div>
  );
}
