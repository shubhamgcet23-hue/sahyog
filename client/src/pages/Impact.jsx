import { useState } from 'react';
import Icon from '../components/Icon';
import { ActivityChart, DataTable, HBar, SERIES, SERIES_LABEL, SimpleLine } from '../components/Charts';
import { Async, PageHeader, StatCard, Tabs } from '../components/ui';
import { useCategories, useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import { FALLBACK_CATEGORIES } from '../utils/constants';
import { fmtDate, fmtNumber } from '../utils/format';

const PERIODS = [{ key: 'week', label: 'Last 7 days' }, { key: 'month', label: 'Last 30 days' }, { key: 'year', label: 'Last 12 months' }];

export default function Impact() {
  const [period, setPeriod] = useState('month');
  const [table, setTable] = useState(false);
  const cats = useCategories() || FALLBACK_CATEGORIES;
  const state = useFetch(() => api.get('/impact', { period }), [period]);
  const nameOf = (slug) => cats.find((c) => c.slug === slug)?.name || slug;

  return (
    <div className="container-page py-8">
      <PageHeader eyebrow="Community impact" title="What Sahyog has made possible" subtitle="Every figure below is calculated live from completed exchanges and fulfilled emergency requests." />
      <Tabs tabs={PERIODS} value={period} onChange={setPeriod} label="Time range" />
      <Async state={state}>
        {(d) => {
          const t = d.totals;
          const exchanges = t.completedDonations + t.completedBorrows + t.completedShares;
          return (
            <div className={state.loading ? 'space-y-6 opacity-60 transition' : 'space-y-6'}>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard icon="gift" tone="saffron" label="Donations completed" value={fmtNumber(t.completedDonations)} />
                <StatCard icon="repeat" tone="sky" label="Borrows completed" value={fmtNumber(t.completedBorrows)} />
                <StatCard icon="users" label="Shares completed" value={fmtNumber(t.completedShares)} />
                <StatCard icon="box" label="Items reused or redistributed" value={fmtNumber(t.resourcesRedistributed)} hint={`${fmtNumber(exchanges)} exchanges`} />
                <StatCard icon="heart" label="Active contributors" value={fmtNumber(t.activeContributors)} />
                <StatCard icon="check" tone="red" label="Community needs fulfilled" value={fmtNumber(t.communityNeedsFulfilled)} hint={`${t.openEmergencies} open now`} />
                <StatCard icon="building" tone="sky" label="Organizations participating" value={fmtNumber(t.organizationsParticipating)} hint={`${t.verifiedOrganizations} verified in total`} />
                <StatCard icon="list" tone="saffron" label="Active listings" value={fmtNumber(t.activeListings)} />
              </div>

              <section className="card p-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-sans text-lg font-semibold">Completed exchanges over time</h2>
                  <button type="button" className="link text-sm" onClick={() => setTable((v) => !v)} aria-pressed={table}>{table ? 'Show chart' : 'Show as table'}</button>
                </div>
                {table ? (
                  <DataTable caption="Completed exchanges per period" columns={[{ key: 'label', label: 'Period' }, ...Object.keys(SERIES).map((k) => ({ key: k, label: SERIES_LABEL[k] })), { key: 'emergenciesFulfilled', label: 'Emergencies fulfilled' }]} rows={d.timeline} />
                ) : exchanges === 0 ? <p className="py-10 text-center text-sm text-stone-500">No completed exchanges in this period yet — be the first!</p> : <ActivityChart timeline={d.timeline} />}
              </section>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="card p-5">
                  <h2 className="mb-2 font-sans text-lg font-semibold">Emergency requests fulfilled</h2>
                  <SimpleLine data={d.timeline} dataKey="emergenciesFulfilled" name="Fulfilled" color="#0284c7" />
                </section>
                <section className="card p-5">
                  <h2 className="mb-2 font-sans text-lg font-semibold">Items by category</h2>
                  {d.byCategory.length === 0 ? <p className="py-10 text-center text-sm text-stone-500">No data for this period yet.</p> : <HBar data={d.byCategory.map((c) => ({ name: nameOf(c.category), value: c.units }))} />}
                </section>
              </div>

              <section className="card border-sky-200 bg-sky-50 p-5" aria-labelledby="env">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 id="env" className="flex items-center gap-2 font-sans text-lg font-semibold"><Icon name="leaf" className="h-5 w-5 text-emerald-700" />Estimated environmental benefit <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-sky-800 ring-1 ring-sky-200">Estimate</span></h2>
                    <p className="mt-1 max-w-2xl text-sm text-stone-700">{d.environmental.method}</p>
                  </div>
                  <div className="text-right"><p className="text-3xl font-bold text-brand-900">≈ {fmtNumber(d.environmental.estimatedCo2KgAvoided)} kg</p><p className="text-xs text-stone-600">CO₂e avoided in this period (all time ≈ {fmtNumber(d.allTime.estimatedCo2Kg)} kg)</p></div>
                </div>
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-medium text-sky-900">Show assumptions (kg CO₂e per item)</summary>
                  <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
                    {Object.entries(d.environmental.assumptions.byCategory).map(([k, v]) => <li key={k} className="flex justify-between border-b border-sky-100 py-1"><span>{nameOf(k)}</span><span className="font-semibold">{v}</span></li>)}
                    <li className="flex justify-between py-1"><span>Any other category</span><span className="font-semibold">{d.environmental.assumptions.default}</span></li>
                  </ul>
                  <p className="mt-2 text-xs text-stone-500">Figures are configurable on the server (<code>server/src/config/settings.js</code>) and are illustrative, not measurements. Data since {fmtDate(d.since)}.</p>
                </details>
              </section>
            </div>
          );
        }}
      </Async>
    </div>
  );
}
