import { useState } from 'react';
import toast from 'react-hot-toast';
import Icon from './Icon';
import LocationPicker from './LocationPicker';
import { Modal } from './ui';
import { useLocationContext } from '../context/LocationContext';

/** "Use my location / choose on map / clear" row plus an optional radius slider. Shared by list pages. */
export default function LocationBar({ radius, onRadius, maxRadius = 100 }) {
  const { location, setLocation, detect, clear } = useLocationContext();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(location);

  const useMine = async () => {
    try { await detect(); toast.success('Location set'); } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Icon name="pin" className="h-4 w-4 text-brand-600" />
      {location ? <span className="font-medium">{location.label}</span> : <span className="text-stone-500">No location set — showing everything</span>}
      <button type="button" className="btn btn-secondary btn-sm" onClick={useMine}><Icon name="locate" className="h-4 w-4" />Use my location</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDraft(location); setOpen(true); }}>Choose on map / city</button>
      {location && <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>Clear</button>}
      {location && onRadius && (
        <label className="ml-auto flex items-center gap-2">
          <span className="text-stone-600">Within <strong>{radius} km</strong></span>
          <input type="range" min="1" max={maxRadius} value={radius} onChange={(e) => onRadius(e.target.value)} aria-label="Search radius in kilometres" className="accent-brand-600" />
        </label>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Set your location" size="max-w-2xl"
        footer={<><button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="btn btn-primary" disabled={!draft} onClick={() => { setLocation(draft); setOpen(false); }}>Use this location</button></>}>
        <LocationPicker value={draft} onChange={setDraft} showPrivacyNote={false} />
      </Modal>
    </div>
  );
}
