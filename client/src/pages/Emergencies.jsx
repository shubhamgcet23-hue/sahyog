import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import LocationBar from '../components/LocationBar';
import MapView from '../components/MapView';
import { EmergencyCard } from '../components/Cards';
import { Async, EmptyState, PageHeader, Pagination, SafetyNotice, StatCard } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import { useDebounce, useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import { EMERGENCY_CATEGORIES, EMERGENCY_STATUS, URGENCY, cn } from '../utils/constants';
import { coordsOf, fmtKm } from '../utils/format';

export default function Emergencies() {
  const { user } = useAuth();
  const { location } = useLocationContext();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const dq = useDebounce(q);
  const get = (k, d = '') => sp.get(k) || d;
  const view = get('view', 'list');
  const radius = Number(get('radius', 50));
  const page = Number(get('page', 1));
  const mine = get('mine') === '1';

  const update = (patch, resetPage = true) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => { if (v === '' || v === undefined || v === null) next.delete(k); else next.set(k, v); });
    if (resetPage && !('page' in patch)) next.delete('page');
    setSp(next, { replace: true });
  };
  useEffect(() => { if (dq !== (sp.get('q') || '')) update({ q: dq }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dq]);

  const params = { q: get('q'), category: get('category'), urgency: get('urgency'), status: get('status', 'ACTIVE'), mine: mine ? 'true' : undefined, page, limit: view === 'map' ? 50 : 12, ...(location ? { lat: location.lat, lng: location.lng, radius } : {}) };
  const list = useFetch(() => api.get('/emergencies', params), [JSON.stringify(params)]);
  const summary = useFetch(() => api.get('/impact', { period: 'month' }), []);

  const markers = useMemo(() => (list.data || []).map((e) => {
    const c = coordsOf(e.location);
    return c && { id: e._id, ...c, color: URGENCY[e.urgency]?.color, title: e.title, subtitle: `${URGENCY[e.urgency]?.label} urgency${e.distanceKm !== undefined ? ` · ${fmtKm(e.distanceKm)}` : ''}`, href: `/emergencies/${e._id}` };
  }).filter(Boolean), [list.data]);

  return (
    <div className="container-page py-8">
      <PageHeader eyebrow="Community help" title="Emergency assistance" subtitle="Urgent needs from neighbours and verified organizations — offer what you can, or ask for help."
        actions={user ? <Link to="/emergencies/new" className="btn btn-danger"><Icon name="plus" className="h-4 w-4" />Request help</Link> : <Link to="/login" state={{ from: '/emergencies/new' }} className="btn btn-danger">Sign in to request help</Link>} />
      <div className="mb-6"><SafetyNotice /></div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard icon="alert" tone="red" label="Open requests right now" value={summary.data?.totals.openEmergencies ?? '—'} />
        <StatCard icon="check" label="Fulfilled this month" value={summary.data?.totals.emergenciesResolved ?? '—'} />
        <StatCard icon="users" tone="saffron" label="Verified organizations" value={summary.data?.totals.verifiedOrganizations ?? '—'} />
      </div>

      <div className="card mb-6 space-y-4 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <label htmlFor="eq" className="sr-only">Search emergency requests</label>
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input id="eq" type="search" className="input !pl-9" placeholder="Search requests…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div><label htmlFor="ecat" className="sr-only">Category</label>
            <select id="ecat" className="input" value={get('category')} onChange={(e) => update({ category: e.target.value })}>
              <option value="">All categories</option>{Object.entries(EMERGENCY_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></div>
          <div><label htmlFor="eurg" className="sr-only">Urgency</label>
            <select id="eurg" className="input" value={get('urgency')} onChange={(e) => update({ urgency: e.target.value })}>
              <option value="">Any urgency</option>{Object.entries(URGENCY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></div>
          <div><label htmlFor="estat" className="sr-only">Status</label>
            <select id="estat" className="input" value={get('status', 'ACTIVE')} onChange={(e) => update({ status: e.target.value === 'ACTIVE' ? '' : e.target.value })}>
              <option value="ACTIVE">Active (open / matched)</option><option value="ALL">All statuses</option>
              {Object.entries(EMERGENCY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></div>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-stone-100 pt-3">
          <LocationBar radius={radius} onRadius={(v) => update({ radius: v })} />
          {user && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">
              <input type="checkbox" className="h-4 w-4 rounded border-stone-300 text-brand-600" checked={mine} onChange={(e) => update({ mine: e.target.checked ? '1' : '' })} />Only my requests
            </label>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-stone-600" aria-live="polite">{list.meta ? `${list.meta.total} request${list.meta.total === 1 ? '' : 's'}` : ''}</p>
        <div className="inline-flex rounded-xl bg-stone-200/70 p-1" role="group" aria-label="View">
          {[['list', 'List', 'list'], ['map', 'Map', 'map']].map(([k, l, icon]) => (
            <button key={k} type="button" onClick={() => update({ view: k === 'list' ? '' : k }, false)} aria-pressed={view === k} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold', view === k ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-600')}>
              <Icon name={icon} className="h-4 w-4" />{l}
            </button>
          ))}
        </div>
      </div>

      <Async state={list} empty={<EmptyState icon="heart" title="No matching requests" text="That’s good news — or try widening your filters or radius." />}>
        {(items) => view === 'map' ? (
          <div>
            <MapView className="h-[28rem] md:h-[34rem]" center={location || undefined} me={location || undefined} radiusKm={location ? radius : undefined} markers={markers} zoom={10} />
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-600">{Object.entries(URGENCY).map(([k, u]) => <span key={k} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: u.color }} />{u.label}</span>)}<span>Pins show approximate areas.</span></div>
          </div>
        ) : <div className={cn('grid gap-5 sm:grid-cols-2 lg:grid-cols-3', list.loading && 'opacity-60 transition')}>{items.map((e) => <EmergencyCard key={e._id} e={e} />)}</div>}
      </Async>
      {view === 'list' && <Pagination meta={list.meta} onPage={(p) => { update({ page: p }, false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}
    </div>
  );
}
