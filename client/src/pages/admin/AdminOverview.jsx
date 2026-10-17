import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ActivityChart, DataTable, HBar, SimpleLine } from '../../components/Charts';
import { Async, PageHeader, Pagination, StatCard, Tabs } from '../../components/ui';
import { useFetch } from '../../hooks/useFetch';
import { api } from '../../services/api';
import { CATEGORY_NAMES } from '../../utils/constants';
import { fmtDateTime, fmtNumber, timeAgo } from '../../utils/format';

const pretty = (s = '') => s.replace(/[._]/g, ' ').replace(/_/g, ' ').toLowerCase();

export default function AdminOverview() {
  const [range, setRange] = useState('month');
  const [logPage, setLogPage] = useState(1);
  const ov = useFetch(() => api.get('/admin/overview'), []);
  const an = useFetch(() => api.get('/admin/analytics', { range }), [range]);
  const logs = useFetch(() => api.get('/admin/audit-logs', { page: logPage, limit: 10 }), [logPage]);

  return (
    <div className="space-y-8">
      <PageHeader title="Platform overview" subtitle="Live numbers from the database." />
      <Async state={ov}>
        {({ counts: s, recentActivity }) => (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard icon="users" label="Registered members" value={fmtNumber(s.users + s.orgsActive)} hint={`${fmtNumber(s.users)} individuals · ${fmtNumber(s.orgsActive)} organizations`} />
              <StatCard icon="building" tone="sky" label="Verified organizations" value={fmtNumber(s.verifiedOrgs)} />
              <StatCard icon="box" tone="saffron" label="Resource listings" value={fmtNumber(s.resources)} />
              <StatCard icon="shield" tone="red" label="Pending verifications" value={fmtNumber(s.pendingVerifications)} hint={<Link to="/admin/organizations" className="link">Review applications</Link>} />
              <StatCard icon="repeat" label="Active requests" value={fmtNumber(s.activeRequests)} />
              <StatCard icon="check" tone="sky" label="Completed exchanges" value={fmtNumber(s.completedExchanges)} />
              <StatCard icon="alert" tone="red" label="Open emergencies" value={fmtNumber(s.openEmergencies)} />
              <StatCard icon="flag" tone="saffron" label="Reports to review" value={fmtNumber(s.pendingReports)} hint={<Link to="/admin/moderation" className="link">{s.pendingAppeals} appeal(s) pending</Link>} />
            </div>

            <section className="card p-5">
              <h2 className="mb-3 font-sans text-base font-semibold">Recent platform activity</h2>
              {recentActivity.length === 0 ? <p className="text-sm text-stone-500">Nothing yet.</p> : (
                <ul className="divide-y divide-stone-100 text-sm">
                  {recentActivity.map((a, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0 truncate"><span className="mr-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs uppercase text-stone-500">{a.type}</span>{a.text}</span>
                      <time className="shrink-0 text-xs text-stone-400" dateTime={a.at}>{timeAgo(a.at)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </Async>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl">Analytics</h2>
          <Tabs tabs={[{ key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }, { key: 'year', label: 'Year' }]} value={range} onChange={setRange} label="Analytics range" />
        </div>
        <Async state={an}>
          {(d) => (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card p-5"><h3 className="mb-2 font-sans text-base font-semibold">Completed exchanges</h3><ActivityChart timeline={d.impact.timeline} /></div>
              <div className="card p-5"><h3 className="mb-2 font-sans text-base font-semibold">New sign-ups</h3><SimpleLine data={d.growth} dataKey="users" name="Sign-ups" color="#1a9a5b" /></div>
              <div className="card p-5"><h3 className="mb-2 font-sans text-base font-semibold">New listings</h3><SimpleLine data={d.growth} dataKey="listings" name="Listings" color="#d4690a" /></div>
              <div className="card p-5"><h3 className="mb-2 font-sans text-base font-semibold">New requests</h3><SimpleLine data={d.growth} dataKey="requests" name="Requests" color="#0284c7" /></div>
              <div className="card p-5">
                <h3 className="mb-2 font-sans text-base font-semibold">Listings by category</h3>
                {d.listingsByCategory.length ? <HBar data={d.listingsByCategory.map((c) => ({ name: CATEGORY_NAMES[c.label] || c.label, value: c.value }))} /> : <p className="py-8 text-center text-sm text-stone-500">No listings yet.</p>}
              </div>
              <div className="card p-5">
                <h3 className="mb-2 font-sans text-base font-semibold">Requests by status (all time)</h3>
                <DataTable caption="Requests by status" columns={[{ key: 'status', label: 'Status' }, { key: 'n', label: 'Count' }]} rows={d.requestStatus.map((x) => ({ status: pretty(x.label), n: x.value }))} />
                <h3 className="mb-2 mt-5 font-sans text-base font-semibold">Listings by type</h3>
                <DataTable caption="Listings by type" columns={[{ key: 'type', label: 'Type' }, { key: 'n', label: 'Count' }]} rows={d.listingsByType.map((x) => ({ type: pretty(x.label), n: x.value }))} />
              </div>
            </div>
          )}
        </Async>
      </section>

      <section>
        <h2 className="mb-3 text-2xl">Audit log</h2>
        <Async state={logs} empty={<p className="text-sm text-stone-500">No administrative actions recorded yet.</p>}>
          {(items) => (
            <div className="card p-4">
              <DataTable
                caption="Administrative audit log"
                columns={[{ key: 'when', label: 'When' }, { key: 'admin', label: 'Admin' }, { key: 'action', label: 'Action' }, { key: 'target', label: 'Target' }]}
                rows={items.map((a) => ({ when: fmtDateTime(a.createdAt), admin: a.admin?.name || '—', action: pretty(a.action), target: a.targetType }))}
              />
            </div>
          )}
        </Async>
        <Pagination meta={logs.meta} onPage={setLogPage} />
      </section>
    </div>
  );
}
