
import { useState } from 'react';
import Icon from '../components/Icon';
import {
  ActivityChart,
  DataTable,
  HBar,
  SERIES,
  SERIES_LABEL,
  SimpleLine,
} from '../components/Charts';
import { Async, PageHeader, StatCard, Tabs } from '../components/ui';
import { useCategories, useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import { FALLBACK_CATEGORIES } from '../utils/constants';
import { fmtDate, fmtNumber } from '../utils/format';

const PERIODS = [
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'Last 30 days' },
  { key: 'year', label: 'Last 12 months' },
];

export default function Impact() {
  const [period, setPeriod] = useState('month');
  const [table, setTable] = useState(false);

  const categories = useCategories() || FALLBACK_CATEGORIES;

  const state = useFetch(
    () => api.get('/impact', { period }),
    [period]
  );

  const nameOf = (slug) =>
    categories.find((category) => category.slug === slug)?.name || slug;

  return (
    <div className="container-page py-8">
      <PageHeader
        eyebrow="Community impact"
        title="What Sahyog has made possible"
        subtitle="Every figure below is calculated from completed exchanges and fulfilled emergency requests."
      />

      <Tabs
        tabs={PERIODS}
        value={period}
        onChange={setPeriod}
        label="Time range"
      />

      <Async state={state}>
        {(d) => {
          const data = d ?? {};
          const totals = data.totals ?? {};
          const environmental = data.environmentalEstimate ?? {};
          const assumptions = data.assumptions ?? {};
          const allTime = data.allTime ?? {};

          const timeline = Array.isArray(data.timeline)
            ? data.timeline
            : Array.isArray(data.series)
              ? data.series
              : [];

          const byCategory = Array.isArray(data.byCategory)
            ? data.byCategory
            : [];

          const donations = totals.completedDonations ?? 0;
          const borrowShareExchanges =
            totals.borrowAndShareExchanges ?? 0;

          const exchanges = donations + borrowShareExchanges;

          return (
            <div
              className={
                state.loading
                  ? 'space-y-6 opacity-60 transition'
                  : 'space-y-6'
              }
            >
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  icon="gift"
                  tone="saffron"
                  label="Donations completed"
                  value={fmtNumber(donations)}
                />

                <StatCard
                  icon="repeat"
                  tone="sky"
                  label="Borrow/share exchanges"
                  value={fmtNumber(borrowShareExchanges)}
                />

                <StatCard
                  icon="box"
                  label="Items reused or redistributed"
                  value={fmtNumber(totals.resourcesReused ?? 0)}
                  hint={`${fmtNumber(exchanges)} exchanges in this period`}
                />

                <StatCard
                  icon="heart"
                  label="Active contributors"
                  value={fmtNumber(totals.activeContributors ?? 0)}
                />

                <StatCard
                  icon="check"
                  tone="red"
                  label="Community needs fulfilled"
                  value={fmtNumber(totals.communityNeedsFulfilled ?? 0)}
                  hint={`${fmtNumber(totals.openEmergencies ?? 0)} open now`}
                />

                <StatCard
                  icon="building"
                  tone="sky"
                  label="Organizations contributing"
                  value={fmtNumber(totals.organizationsContributing ?? 0)}
                />

                <StatCard
                  icon="shield"
                  label="Verified organizations"
                  value={fmtNumber(totals.verifiedOrganizations ?? 0)}
                />

                <StatCard
                  icon="list"
                  tone="saffron"
                  label="Active listings"
                  value={fmtNumber(totals.activeListings ?? 0)}
                />
              </div>

              <section className="card p-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-sans text-lg font-semibold">
                    Completed exchanges over time
                  </h2>

                  <button
                    type="button"
                    className="link text-sm"
                    onClick={() => setTable((value) => !value)}
                    aria-pressed={table}
                  >
                    {table ? 'Show chart' : 'Show as table'}
                  </button>
                </div>

                {table ? (
                  <DataTable
                    caption="Completed exchanges per period"
                    columns={[
                      { key: 'label', label: 'Period' },
                      ...Object.keys(SERIES).map((key) => ({
                        key,
                        label: SERIES_LABEL[key],
                      })),
                      {
                        key: 'emergenciesFulfilled',
                        label: 'Emergencies fulfilled',
                      },
                    ]}
                    rows={timeline}
                  />
                ) : exchanges === 0 ? (
                  <p className="py-10 text-center text-sm text-stone-500">
                    No completed exchanges in this period yet — be the first!
                  </p>
                ) : (
                  <ActivityChart timeline={timeline} />
                )}
              </section>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="card p-5">
                  <h2 className="mb-2 font-sans text-lg font-semibold">
                    Emergency requests fulfilled
                  </h2>

                  <SimpleLine
                    data={timeline}
                    dataKey="emergenciesFulfilled"
                    name="Fulfilled"
                    color="#0284c7"
                  />
                </section>

                <section className="card p-5">
                  <h2 className="mb-2 font-sans text-lg font-semibold">
                    Items by category
                  </h2>

                  {byCategory.length === 0 ? (
                    <p className="py-10 text-center text-sm text-stone-500">
                      No data for this period yet.
                    </p>
                  ) : (
                    <HBar
                      data={byCategory.map((category) => ({
                        name: nameOf(category.category),
                        value: category.units,
                      }))}
                    />
                  )}
                </section>
              </div>

              <section
                className="card border-sky-200 bg-sky-50 p-5"
                aria-labelledby="env"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2
                      id="env"
                      className="flex items-center gap-2 font-sans text-lg font-semibold"
                    >
                      <Icon
                        name="leaf"
                        className="h-5 w-5 text-emerald-700"
                      />

                      Estimated environmental benefit

                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-sky-800 ring-1 ring-sky-200">
                        Estimate
                      </span>
                    </h2>

                    <p className="mt-1 max-w-2xl text-sm text-stone-700">
                      {environmental.method ??
                        'Estimated benefit based on configurable per-item factors; not audited.'}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-3xl font-bold text-brand-900">
                      ≈ {fmtNumber(environmental.kgCo2e ?? 0)} kg
                    </p>

                    <p className="text-xs text-stone-600">
                      CO₂e avoided in this period (all time ≈{' '}
                      {fmtNumber(allTime.kgCo2e ?? 0)} kg)
                    </p>
                  </div>
                </div>

                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-medium text-sky-900">
                    Show assumptions (kg CO₂e per item)
                  </summary>

                  <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
                    {Object.entries(assumptions.byCategory ?? {}).map(
                      ([key, value]) => (
                        <li
                          key={key}
                          className="flex justify-between border-b border-sky-100 py-1"
                        >
                          <span>{nameOf(key)}</span>
                          <span className="font-semibold">{value}</span>
                        </li>
                      )
                    )}

                    <li className="flex justify-between py-1">
                      <span>Any other category</span>
                      <span className="font-semibold">
                        {assumptions.default ?? 0}
                      </span>
                    </li>
                  </ul>

                  <p className="mt-2 text-xs text-stone-500">
                    These figures are illustrative estimates, not audited
                    measurements. Data since{' '}
                    {data.since ? fmtDate(data.since) : 'the selected period'}.
                  </p>

                  {environmental.note && (
                    <p className="mt-1 text-xs text-stone-500">
                      {environmental.note}
                    </p>
                  )}
                </details>
              </section>
            </div>
          );
        }}
      </Async>
    </div>
  );
}
