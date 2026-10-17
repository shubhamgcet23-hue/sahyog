import { useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { cn } from '../utils/constants';

const cache = {};
/** CSS-only pins (no image assets to break in bundlers). Styles live in index.css (.sahyog-pin). */
export function pinIcon(color = '#1f6c5a', me = false) {
  const key = `${color}-${me}`;
  if (!cache[key]) {
    cache[key] = L.divIcon({
      className: `sahyog-pin${me ? ' me' : ''}`,
      html: `<span style="background:${color}"></span>`,
      iconSize: me ? [16, 16] : [22, 22],
      iconAnchor: me ? [8, 8] : [11, 22],
      popupAnchor: [0, -20],
    });
  }
  return cache[key];
}

function Fit({ points, center, zoom }) {
  const map = useMap();
  const sig = points.map((p) => `${p[0]},${p[1]}`).join('|');
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
    else if (points.length === 1) map.setView(points[0], Math.max(zoom, 13));
    else map.setView(center, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, center[0], center[1]]);
  return null;
}

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick && onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/**
 * markers: [{ id, lat, lng, color, title, subtitle, href }]
 * me: { lat, lng } (the searcher's position), radiusKm draws the search radius around `me`.
 * onPick: makes the map clickable (location pickers).
 */
export default function MapView({ center = { lat: 28.4744, lng: 77.504 }, zoom = 12, markers = [], me, radiusKm, onPick, className = 'h-96', fit = true, draggablePin, area }) {
  const centerArr = useMemo(() => [center.lat, center.lng], [center.lat, center.lng]);
  const points = useMemo(() => (fit ? markers.map((m) => [m.lat, m.lng]).concat(me && markers.length === 0 ? [[me.lat, me.lng]] : []) : []), [markers, me, fit]);
  return (
    <MapContainer center={centerArr} zoom={zoom} scrollWheelZoom={false} className={cn('z-0 w-full overflow-hidden rounded-2xl border border-stone-200', className)}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
      {fit ? <Fit points={points} center={centerArr} zoom={zoom} /> : <Fit points={[]} center={centerArr} zoom={zoom} />}
      {onPick && <ClickHandler onPick={onPick} />}
      {me && <Marker position={[me.lat, me.lng]} icon={pinIcon('#2563eb', true)}><Popup>Your search location</Popup></Marker>}
      {me && radiusKm && <Circle center={[me.lat, me.lng]} radius={radiusKm * 1000} pathOptions={{ color: '#2a8670', weight: 1, fillOpacity: 0.06 }} />}
      {area && <Circle center={[area.lat, area.lng]} radius={area.radiusKm * 1000} pathOptions={{ color: '#2a8670', weight: 1, fillOpacity: 0.12 }} />}
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={pinIcon(m.color)}
          draggable={!!draggablePin}
          eventHandlers={draggablePin ? { dragend: (e) => { const p = e.target.getLatLng(); draggablePin({ lat: p.lat, lng: p.lng }); } } : undefined}
        >
          {(m.title || m.href) && (
            <Popup>
              <div className="min-w-[140px]">
                {m.title && <p className="font-semibold text-stone-900">{m.title}</p>}
                {m.subtitle && <p className="text-xs text-stone-600">{m.subtitle}</p>}
                {m.href && <Link to={m.href} className="mt-1 inline-block text-xs font-semibold text-brand-700 underline">View details</Link>}
              </div>
            </Popup>
          )}
        </Marker>
      ))}
    </MapContainer>
  );
}
