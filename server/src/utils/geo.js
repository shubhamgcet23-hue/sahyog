const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Round a GeoJSON Point to `decimals` places (2 dp ~ 1.1 km) so exact addresses are never public. */
function approximatePoint(point, decimals = 2) {
  if (!point || !Array.isArray(point.coordinates) || point.coordinates.length !== 2) return point;
  const f = 10 ** decimals;
  return { type: 'Point', coordinates: point.coordinates.map((c) => Math.round(c * f) / f) };
}

const toPoint = (lat, lng) => ({ type: 'Point', coordinates: [Number(lng), Number(lat)] });

/** Round distance (metres) to 0.1 km for display. */
const approxKm = (meters) => (typeof meters === 'number' ? Math.round(meters / 100) / 10 : undefined);

module.exports = { escapeRegex, approximatePoint, toPoint, approxKm };
