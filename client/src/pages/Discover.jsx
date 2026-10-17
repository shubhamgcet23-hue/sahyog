import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import MapView from '../components/MapView';
import LocationPicker from '../components/LocationPicker';
import { ResourceCard } from '../components/Cards';
import { Async, EmptyState, Modal, PageHeader, Pagination, Spinner } from '../components/ui';
import { useCategories, useDebounce, useFetch } from '../hooks/useFetch';
import { useLocationContext } from '../context/LocationContext';
import { api } from '../services/api';
import { CONDITIONS, FALLBACK_CATEGORIES, TYPE_META, cn } from '../utils/constants';
import { coordsOf, fmtKm } from '../utils/format';

export default function Discover() {
  const [sp, setSp] = useSearchParams();
  const { location, setLocation, detect, clear } = useLocationContext();
  const categories = useCategories() || FALLBACK_CATEGORIES;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState(location);
  const [q, setQ] = useState(sp.get('q') || '');
  const dq = useDebounce(q);

  const get = (k, d = '') => sp.get(k) || d;
  const view = get('view', 'list');
  const sort = get('sort', 'newest');
  const radius = Number(get('radius', 25));
  const page = Number(get('page', 1));
  const type = get('type');
  const category = get('category');
  const condition = get('condition');
  const showAll = get('all') === '1';

  const update = (patch, resetPage = true) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => { if (v === '' || v === undefined || v === null) next.delete(k); else next.set(k, v); });
    if (resetPage && !('page' in patch)) next.delete('page');
    setSp(next, { replace: true });
  };

  useEffect(() => { if (dq !== (sp.get('q') || '')) update({ q: dq }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dq]);
  // Distance sorting needs a location; fall back to newest if it was cleared.
  useEffect(() => { if (sort === 'distance' && !location) update({ sort: '' }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [location, sort]);

  const geo = location ? { lat: location.lat, lng: location.lng, radiusKm: radius } : {};
  const params = { q: get('q'), category, type, condition, availability: showAll ? 'all' : undefined, sort: sort === 'distance' && location ? 'nearest' : 'newest', page, limit: 12, ...geo };
  const list = useFetch(() => api.get('/resources', params), [JSON.stringify(params)], { enabled: view === 'list' });
  const mapData = useFetch(() => api.get('/resources/nearby', { lat: location.lat, lng: location.lng, radiusKm: radius, category, type, limit: 150 }), [location?.lat, location?.lng, radius, category, type], { enabled: view === 'map' && !!location });

  const markers = useMemo(() => (mapData.data || []).map((r) => {
    const c = coordsOf(r.location);
    return c && { id: r._id, ...c, color: TYPE_META[r.availabilityType]?.color, title: r.title, subtitle: `${TYPE_META[r.availabilityType]?.label} · ${fmtKm(r.distanceKm)}`, href: `/resources/${r._id}` };
  }).filter(Boolean), [mapData.data]);

  const useMine = async () => {
    try { await detect(); toast.success('Location set'); } catch (e) { toast.error(e.message); }
  };

  const chip = (active) => cn('rounded-full border px-3.5 py-1.5 text-sm font-semibold transition', active ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-brand-400');

  return (
    <div className="container-page py-8">
      <PageHeader eyebrow="Discover" title="Resources near you" subtitle="Borrow, receive or share what your neighbours have to offer." actions={<Link to="/resources/new" className="btn btn-accent"><Icon name="plus" className="h-4 w-4" />Share a resource</Link>} />

      {/* filters */}
      <div className="card mb-6 space-y-4 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <label htmlFor="q" className="sr-only">Search resources</label>
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input id="q" type="search" className="input !pl-9" placeholder="Search by title or description…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div>
            <label htmlFor="cat" className="sr-only">Category</label>
            <select id="cat" className="input" value={category} onChange={(e) => update({ category: e.target.value })}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cond" className="sr-only">Condition</label>
            <select id="cond" className="input" value={condition} onChange={(e) => update({ condition: e.target.value })}>
              <option value="">Any condition</option>
              {Object.entries(CONDITIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="sort" className="sr-only">Sort by</label>
            <select id="sort" className="input" value={sort} onChange={(e) => update({ sort: e.target.value })}>
              <option value="newest">Newest first</option>
              <option value="distance" disabled={!location}>Nearest first{!location ? ' (set location)' : ''}</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={chip(!type)} onClick={() => update({ type: '' })} aria-pressed={!type}>All types</button>
          {Object.entries(TYPE_META).map(([k, m]) => <button key={k} type="button" className={chip(type === k)} onClick={() => update({ type: k })} aria-pressed={type === k}>{m.label}</button>)}
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" className="h-4 w-4 rounded border-stone-300 text-brand-600" checked={showAll} onChange={(e) => update({ all: e.target.checked ? '1' : '' })} />
            Include fully allocated
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 pt-3 text-sm">
          <Icon name="pin" className="h-4 w-4 text-brand-600" />
          {location ? <span className="font-medium">{location.label}</span> : <span className="text-stone-500">No location set — showing everything</span>}
          <button type="button" className="btn btn-secondary btn-sm" onClick={useMine}><Icon name="locate" className="h-4 w-4" />Use my location</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDraft(location); setPickerOpen(true); }}>Choose on map / city</button>
          {location && <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>Clear</button>}
          {location && (
            <label className="ml-auto flex items-center gap-2">
              <span className="text-stone-600">Within <strong>{radius} km</strong></span>
              <input type="range" min="1" max="100" value={radius} onChange={(e) => update({ radius: e.target.value })} aria-label="Search radius in kilometres" className="accent-brand-600" />
            </label>
          )}
        </div>
      </div>

      {/* view toggle */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-stone-600" aria-live="polite">{view === 'list' && list.meta ? `${list.meta.total} resource${list.meta.total === 1 ? '' : 's'} found` : view === 'map' && mapData.data ? `${mapData.data.length} on the map` : ''}</p>
        <div className="inline-flex rounded-xl bg-stone-200/70 p-1" role="group" aria-label="View">
          {[['list', 'List', 'list'], ['map', 'Map', 'map']].map(([k, l, icon]) => (
            <button key={k} type="button" onClick={() => update({ view: k === 'list' ? '' : k }, false)} aria-pressed={view === k} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold', view === k ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-600')}>
              <Icon name={icon} className="h-4 w-4" />{l}
            </button>
          ))}
        </div>
      </div>

      {view === 'list' ? (
        <>
          <Async state={list} empty={<EmptyState icon="search" title="Nothing matches yet" text="Try a wider radius, remove a filter, or share something yourself." action={<Link to="/resources/new" className="btn btn-primary">Share a resource</Link>} />}>
            {(items) => <div className={cn('grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', list.loading && 'opacity-60 transition')}>{items.map((r) => <ResourceCard key={r._id} resource={r} />)}</div>}
          </Async>
          <Pagination meta={list.meta} onPage={(p) => { update({ page: p }, false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </>
      ) : !location ? (
        <EmptyState icon="pin" title="Set your location to see the map" text="Use your current location (only after you allow it) or choose a city or point on the map." action={<button type="button" className="btn btn-primary" onClick={useMine}>Use my location</button>} />
      ) : (
        <div className="relative">
          {mapData.loading && <div className="absolute right-3 top-3 z-[500] rounded-full bg-white p-2 shadow"><Spinner className="h-4 w-4" /></div>}
          {mapData.error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{mapData.error}</p>}
          <MapView className="h-[28rem] md:h-[34rem]" center={location} me={location} radiusKm={radius} markers={markers} zoom={11} />
          {mapData.data && mapData.data.length === 0 && <p className="mt-3 text-center text-sm text-stone-500">No resources within {radius} km. Try a larger radius.</p>}
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-600">
            {Object.entries(TYPE_META).map(([k, m]) => <span key={k} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: m.color }} />{m.label}</span>)}
            <span>Pins show approximate areas, not exact addresses.</span>
          </div>
        </div>
      )}

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Set your search location" size="max-w-2xl"
        footer={<><button type="button" className="btn btn-secondary" onClick={() => setPickerOpen(false)}>Cancel</button><button type="button" className="btn btn-primary" disabled={!draft} onClick={() => { setLocation(draft); setPickerOpen(false); }}>Use this location</button></>}>
        <LocationPicker value={draft} onChange={setDraft} showPrivacyNote={false} />
      </Modal>
    </div>
  );
}
