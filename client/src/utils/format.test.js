import { afterEach, describe, expect, it, vi } from 'vitest';
import { coordsOf, fmtKm, initials, isVerifiedOrg, orgName, plural, timeAgo, toInputDate } from './format';
import { cn } from './constants';

describe('format helpers', () => {
  afterEach(() => vi.useRealTimers());

  it('describes distances without implying precision', () => {
    expect(fmtKm(undefined)).toBe('');
    expect(fmtKm(0.4)).toBe('under 1 km away');
    expect(fmtKm(3.2)).toBe('about 3.2 km away');
  });

  it('builds initials and plurals', () => {
    expect(initials('Asha Verma Singh')).toBe('AV');
    expect(initials('')).toBe('?');
    expect(plural(1, 'item')).toBe('1 item');
    expect(plural(3, 'item')).toBe('3 items');
  });

  it('converts GeoJSON [lng, lat] into lat/lng', () => {
    expect(coordsOf({ type: 'Point', coordinates: [77.5, 28.47] })).toEqual({ lat: 28.47, lng: 77.5 });
    expect(coordsOf(null)).toBeNull();
  });

  it('formats relative times', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T12:00:00Z'));
    expect(timeAgo('2026-01-10T11:59:40Z')).toBe('just now');
    expect(timeAgo('2026-01-10T11:30:00Z')).toBe('30 min ago');
    expect(timeAgo('2026-01-10T07:00:00Z')).toBe('5 h ago');
    expect(timeAgo('2026-01-07T12:00:00Z')).toBe('3 d ago');
  });

  it('formats input dates and organization names', () => {
    expect(toInputDate('2026-03-05T10:00:00Z')).toBe('2026-03-05');
    expect(orgName({ name: 'Ravi', organizationDetails: { orgName: 'Helping Hands' } })).toBe('Helping Hands');
    expect(isVerifiedOrg({ organizationDetails: { verificationStatus: 'VERIFIED' } })).toBe(true);
    expect(isVerifiedOrg({ organizationDetails: { verificationStatus: 'PENDING' } })).toBe(false);
  });

  it('joins class names, skipping falsy values', () => {
    expect(cn('a', false, undefined, 'b')).toBe('a b');
  });
});
