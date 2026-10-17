const { approximatePoint, escapeRegex, approxKm, toPoint } = require('../../src/utils/geo');

describe('geo helpers', () => {
  test('approximatePoint rounds to ~1 km so exact spots are hidden', () => {
    const p = approximatePoint(toPoint(28.474412, 77.504091), 2);
    expect(p.coordinates).toEqual([77.5, 28.47]);
  });
  test('toPoint is [lng, lat]', () => expect(toPoint(10, 20).coordinates).toEqual([20, 10]));
  test('escapeRegex neutralises regex metacharacters', () => {
    expect(new RegExp(escapeRegex('a.b(c)*'), 'i').test('A.B(C)*')).toBe(true);
    expect(new RegExp(escapeRegex('a.b'), 'i').test('axb')).toBe(false);
  });
  test('approxKm rounds to 0.1 km', () => expect(approxKm(1234)).toBe(1.2));
});
