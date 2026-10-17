import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { coordsOf } from '../utils/format';

const KEY = 'sahyog.location';
const LocationContext = createContext(null);

const read = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lng) ? v : null;
  } catch {
    return null;
  }
};
const write = (v) => {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch { /* private mode: location just isn't remembered */ }
};

/** Browser geolocation (asks permission only when called from a click). Resolves { lat, lng }. */
export function detectPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Your browser does not support location. Pick a city or place a pin on the map instead.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => reject(new Error(err.code === 1 ? 'Location permission was denied. You can pick a city or place a pin on the map instead.' : 'Could not determine your location. Try picking a city instead.')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

export function LocationProvider({ children }) {
  const { user } = useAuth();
  const [location, setLoc] = useState(read);

  // Default to the area saved on the user's profile (never the exact address) until they choose another.
  useEffect(() => {
    if (!location && user?.location) {
      const c = coordsOf(user.location);
      if (c) setLoc({ ...c, label: user.areaLabel || 'My area' });
    }
  }, [user, location]);

  const setLocation = useCallback((v) => { setLoc(v); write(v); }, []);
  const detect = useCallback(async () => {
    const p = await detectPosition();
    const v = { ...p, label: 'My current location' };
    setLocation(v);
    return v;
  }, [setLocation]);

  const value = useMemo(() => ({ location, setLocation, detect, clear: () => setLocation(null) }), [location, setLocation, detect]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export const useLocationContext = () => useContext(LocationContext);
