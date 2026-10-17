import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { ResourceCard, EmergencyCard } from '../components/Cards';
import { Async, EmptyState, SafetyNotice } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import { fmtNumber } from '../utils/format';

const steps = [
  { icon: 'plus', title: 'List what you can spare', text: 'Add a photo and a few details. Choose to lend it, give it away, or share it with neighbours.' },
  { icon: 'search', title: 'Find what you need nearby', text: 'Search by category on a map. See roughly how far each item is — never anyone’s exact address.' },
  { icon: 'message', title: 'Agree and exchange', text: 'Send a request, chat securely, and meet to hand over. Both sides confirm, then leave a review.' },
];

function Stat({ value, label }) {
  return (
    <div className="text-center">
      <p className="font-display text-4xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-brand-200">{label}</p>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const { location } = useLocationContext();
  const featured = useFetch(() => api.get('/resources', { limit: 6, ...(location ? { lat: location.lat, lng: location.lng, radiusKm: 50, sort: 'nearest' } : {}) }), [location?.lat, location?.lng]);
  const impact = useFetch(() => api.get('/impact', { range: 'year' }), []);
  const emergencies = useFetch(() => api.get('/emergencies', { limit: 3 }), []);
  const t = impact.data?.totals;
  const exchanges = t ? t.completedDonations + t.borrowAndShareExchanges : null;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <svg className="absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden="true">
          <defs><pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="2" fill="#fff" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-saffron-400/20 blur-3xl" aria-hidden="true" />
        <div className="container-page relative grid gap-10 py-16 md:grid-cols-5 md:py-24">
          <div className="md:col-span-3">
            <p className="eyebrow !text-saffron-300">Hyperlocal · Community-powered · Free</p>
            <h1 className="mt-3 text-4xl font-bold !text-white sm:text-5xl lg:text-6xl">Share what you have.<br />Find what you need.</h1>
            <p className="mt-5 max-w-xl text-lg text-brand-100">
              Sahyog connects neighbours, schools, hospitals and NGOs to lend, borrow, donate and share essentials — from textbooks and wheelchairs to winter jackets — right in your own neighbourhood.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/discover" className="btn btn-accent btn-lg"><Icon name="search" />Find resources</Link>
              <Link to={user ? '/resources/new' : '/register'} className="btn btn-lg border border-white/30 text-white hover:bg-white/10"><Icon name="gift" />Share resources</Link>
            </div>
          </div>
          <div className="hidden md:col-span-2 md:block">
            <div className="relative mx-auto mt-4 h-72 w-72">
              {[['🧥', 'left-0 top-4', 'rotate-[-6deg]'], ['📚', 'right-0 top-0', 'rotate-[5deg]'], ['🩺', 'left-10 bottom-2', 'rotate-[4deg]'], ['🔧', 'right-4 bottom-8', 'rotate-[-4deg]']].map(([e, pos, rot]) => (
                <span key={e} className={`absolute ${pos} ${rot} grid h-28 w-28 place-items-center rounded-3xl bg-white/10 text-5xl ring-1 ring-white/20 backdrop-blur`} aria-hidden="true">{e}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Live community numbers (real data) */}
      <section className="bg-brand-800 py-8" aria-label="Community numbers">
        <div className="container-page grid grid-cols-2 gap-6 md:grid-cols-4">
          <Stat value={exchanges === null ? '—' : fmtNumber(exchanges)} label="exchanges completed this year" />
          <Stat value={t ? fmtNumber(t.resourcesReused) : '—'} label="items reused or redistributed" />
          <Stat value={t ? fmtNumber(t.activeContributors) : '—'} label="active contributors" />
          <Stat value={t ? fmtNumber(t.verifiedOrganizations) : '—'} label="verified organizations" />
        </div>
      </section>

      {/* How it works */}
      <section className="container-page py-16">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-1 text-3xl sm:text-4xl">Three simple steps</h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="card relative p-6">
              <span className="absolute right-5 top-4 font-display text-5xl font-bold text-brand-100">{i + 1}</span>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon name={s.icon} /></span>
              <h3 className="mt-4 font-sans text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-stone-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Featured nearby */}
      <section className="container-page pb-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">{location ? `Near ${location.label}` : 'Recently shared'}</p>
            <h2 className="mt-1 text-3xl">Featured {location ? 'nearby ' : ''}resources</h2>
          </div>
          <Link to="/discover" className="link flex items-center gap-1">Browse all <Icon name="arrow" className="h-4 w-4" /></Link>
        </div>
        <Async state={featured} empty={<EmptyState icon="box" title="No resources yet" text="Be the first to share something in your neighbourhood." action={<Link to={user ? '/resources/new' : '/register'} className="btn btn-primary">Share a resource</Link>} />}>
          {(items) => <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((r) => <ResourceCard key={r._id} resource={r} />)}</div>}
        </Async>
      </section>

      {/* Organizations */}
      <section className="bg-brand-50 py-16">
        <div className="container-page grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="eyebrow">Community &amp; NGO participation</p>
            <h2 className="mt-1 text-3xl sm:text-4xl">Built for organizations that serve their communities</h2>
            <p className="mt-4 text-stone-700">Hospitals can lend mobility aids, schools can pass on uniforms, and NGOs can coordinate donation drives. Organizations are verified by our admins, earning a visible badge that builds trust with neighbours.</p>
            <ul className="mt-5 space-y-2 text-sm text-stone-700">
              {['Publish inventory and manage incoming requests', 'Run verified emergency campaigns', 'Track resources contributed and distributed'].map((x) => <li key={x} className="flex gap-2"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />{x}</li>)}
            </ul>
            <Link to="/register" className="btn btn-primary mt-6">Register your organization</Link>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Icon name="shield" className="h-7 w-7" /></span><div><p className="font-display text-3xl font-bold text-brand-900">{t ? fmtNumber(t.verifiedOrganizations) : '—'}</p><p className="text-sm text-stone-600">verified organizations on Sahyog</p></div></div>
            <div className="mt-5 flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-saffron-100 text-saffron-700"><Icon name="building" className="h-7 w-7" /></span><div><p className="font-display text-3xl font-bold text-brand-900">{t ? fmtNumber(t.organizationsContributing) : '—'}</p><p className="text-sm text-stone-600">organizations took part in exchanges this year</p></div></div>
          </div>
        </div>
      </section>

      {/* Emergency */}
      <section className="container-page py-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow !text-red-600">Emergency assistance</p>
            <h2 className="mt-1 text-3xl">Neighbours asking for urgent help</h2>
          </div>
          <Link to="/emergencies" className="link flex items-center gap-1">See all requests <Icon name="arrow" className="h-4 w-4" /></Link>
        </div>
        <div className="mb-6"><SafetyNotice /></div>
        <Async state={emergencies} empty={<EmptyState icon="heart" title="No open requests right now" text="When someone needs urgent community help, it appears here." />}>
          {(items) => <div className="grid gap-5 md:grid-cols-3">{items.map((e) => <EmergencyCard key={e._id} e={e} />)}</div>}
        </Async>
      </section>

      {/* Sustainability */}
      <section className="container-page pb-4">
        <div className="card flex flex-col items-start gap-6 bg-gradient-to-br from-brand-50 to-white p-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon name="leaf" className="h-6 w-6" /></span>
            <div>
              <h2 className="text-2xl">Every reuse counts</h2>
              <p className="mt-1 max-w-xl text-stone-600">
                {impact.data ? <>Over the past year, <strong>{fmtNumber(impact.data.totals.resourcesReused)}</strong> items have found a second life through Sahyog — an estimated <strong>{fmtNumber(impact.data.environmentalEstimate.kgCo2e)} kg CO₂e</strong> of avoided manufacturing <span className="text-stone-500">(rough estimate; assumptions are on the impact page)</span>.</> : 'See how neighbourhood sharing adds up.'}
              </p>
            </div>
          </div>
          <Link to="/impact" className="btn btn-secondary shrink-0">View impact dashboard</Link>
        </div>
      </section>
    </>
  );
}
