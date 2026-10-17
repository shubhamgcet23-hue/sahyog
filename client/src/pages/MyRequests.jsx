import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Async, Badge, EmptyState, NoteDialog, PageHeader, Pagination, StatusBadge, Tabs, TypeBadge, UserChip } from '../components/ui';
import Icon from '../components/Icon';
import { useFetch } from '../hooks/useFetch';
import { api, errMsg } from '../services/api';
import { CATEGORY_EMOJI, REQUEST_STATUS } from '../utils/constants';
import { fmtDate, imgSrc, timeAgo } from '../utils/format';

export function RequestRow({ r, mode, onChanged }) {
  const [declining, setDeclining] = useState(false);
  const other = mode === 'received' ? r.requester : r.owner;
  const src = imgSrc(r.resourceSnapshot?.image);

  const act = async (status, note) => {
    try { await api.patch(`/requests/${r._id}/status`, { status, note: note || undefined }); toast.success(status === 'APPROVED' ? 'Request approved' : 'Request declined'); setDeclining(false); onChanged(); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <li className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <Link to={`/requests/${r._id}`} className="flex min-w-0 flex-1 items-center gap-4">
        {src ? <img src={src} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-brand-50 text-3xl" aria-hidden="true">{CATEGORY_EMOJI[r.resourceSnapshot?.category] || '📦'}</span>}
        <div className="min-w-0">
          <p className="truncate font-semibold text-stone-900">{r.resourceSnapshot?.title || 'Removed listing'}</p>
          <p className="text-sm text-stone-600">{mode === 'received' ? 'Requested by' : 'Owner:'} {other?.organizationDetails?.orgName || other?.name} · qty {r.quantity} · {timeAgo(r.createdAt)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <TypeBadge type={r.requestType} /><StatusBadge status={r.status} />
            {r.isOverdue && <Badge cls="bg-red-600 text-white ring-red-700"><Icon name="clock" className="h-3 w-3" />Overdue</Badge>}
            {r.requestType === 'BORROW' && r.proposedReturnDate && ['APPROVED', 'IN_PROGRESS', 'PENDING'].includes(r.status) && <span className="text-xs text-stone-500">Return by {fmtDate(r.proposedReturnDate)}</span>}
          </div>
        </div>
      </Link>
      {mode === 'received' && r.status === 'PENDING' && (
        <div className="flex gap-2 sm:flex-col">
          <button type="button" className="btn btn-primary btn-sm flex-1" onClick={() => act('APPROVED')}>Approve</button>
          <button type="button" className="btn btn-secondary btn-sm flex-1" onClick={() => setDeclining(true)}>Decline</button>
        </div>
      )}
      <NoteDialog open={declining} onClose={() => setDeclining(false)} onSubmit={(n) => act('REJECTED', n)} title="Decline this request" label="Reason (shared with the requester)" confirmLabel="Decline request" danger placeholder="e.g. Already promised to someone else" />
    </li>
  );
}

export default function MyRequests() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'received' ? 'received' : 'mine';
  const status = sp.get('status') || '';
  const page = Number(sp.get('page') || 1);
  const set = (patch) => { const n = new URLSearchParams(sp); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setSp(n, { replace: true }); };

  const state = useFetch(() => api.get(tab === 'received' ? '/requests/received' : '/requests/me', { status, page, limit: 10 }), [tab, status, page]);

  return (
    <div className="container-page max-w-4xl py-8">
      <PageHeader eyebrow="Exchanges" title="Requests" subtitle="Track what you’ve asked for, and respond to people who want your items." />
      <Tabs tabs={[{ key: 'mine', label: 'I requested' }, { key: 'received', label: 'Received' }]} value={tab} onChange={(k) => set({ tab: k === 'mine' ? '' : k, status: '', page: '' })} label="Request direction" />
      <div className="mb-4 flex items-center gap-2">
        <label htmlFor="st" className="text-sm text-stone-600">Status</label>
        <select id="st" className="input !w-auto !py-1.5" value={status} onChange={(e) => set({ status: e.target.value, page: '' })}>
          <option value="">All</option>
          {Object.entries(REQUEST_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <Async state={state} empty={<EmptyState icon="repeat" title={tab === 'mine' ? 'You haven’t requested anything yet' : 'No requests for your items yet'} text={tab === 'mine' ? 'Browse nearby resources and send your first request.' : 'When someone requests one of your items, it shows up here.'} action={<Link to={tab === 'mine' ? '/discover' : '/resources/new'} className="btn btn-primary">{tab === 'mine' ? 'Discover resources' : 'Share a resource'}</Link>} />}>
        {(items) => <ul className="space-y-3">{items.map((r) => <RequestRow key={r._id} r={r} mode={tab === 'received' ? 'received' : 'mine'} onChanged={state.reload} />)}</ul>}
      </Async>
      <Pagination meta={state.meta} onPage={(p) => set({ page: p > 1 ? String(p) : '' })} />
    </div>
  );
}
