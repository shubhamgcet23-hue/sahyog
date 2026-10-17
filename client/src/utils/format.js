import { API_ORIGIN } from '../services/api';

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });

export const fmtDate = (d) => (d ? dateFmt.format(new Date(d)) : '—');
export const fmtDateTime = (d) => (d ? dateTimeFmt.format(new Date(d)) : '—');
export const fmtTime = (d) => (d ? timeFmt.format(new Date(d)) : '');
export const fmtNumber = (n) => new Intl.NumberFormat('en-IN').format(Math.round(Number(n) || 0));

export function timeAgo(d) {
  if (!d) return '';
  const s = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} d ago`;
  return fmtDate(d);
}

export const fmtKm = (km) => {
  if (km === undefined || km === null) return '';
  return km < 1 ? 'under 1 km away' : `about ${km} km away`;
};

/** Image URLs from the API are either absolute (Cloudinary) or relative (/uploads/...) in development. */
export function imgSrc(img) {
  const url = typeof img === 'string' ? img : img?.url;
  if (!url) return null;
  return /^https?:\/\//.test(url) ? url : `${API_ORIGIN}${url}`;
}

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';

export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export const tomorrowInput = () => toInputDate(new Date(Date.now() + 864e5));

/** GeoJSON Point -> { lat, lng } */
export const coordsOf = (geo) => (geo?.coordinates?.length === 2 ? { lat: geo.coordinates[1], lng: geo.coordinates[0] } : null);

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const orgName = (u) => u?.organizationDetails?.orgName || u?.name || 'Unknown';

export const isVerifiedOrg = (u) => u?.organizationDetails?.verificationStatus === 'VERIFIED';
