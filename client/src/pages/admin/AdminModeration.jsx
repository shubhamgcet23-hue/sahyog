import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Async, Badge, Button, ConfirmDialog, EmptyState, Field, Modal, NoteDialog, PageHeader, Pagination, StatusBadge, Tabs } from '../../components/ui';
import { useDebounce, useFetch } from '../../hooks/useFetch';
import { api, errMsg } from '../../services/api';
import { EMERGENCY_STATUS, REPORT_REASONS, RESOURCE_STATUS, URGENCY } from '../../utils/constants';
import { fmtDateTime, timeAgo } from '../../utils/format';

const run = async (fn, ok, reload) => {
  try { await fn(); toast.success(ok); reload?.(); } catch (e) { toast.error(errMsg(e)); }
};

/* ---------------------------------- Reports ---------------------------------- */

const REPORT_STATUS = {
  PENDING: { label: 'Pending', cls: 'bg-amber-100 text-amber-800 ring-amber-200' },
  REVIEWING: { label: 'Reviewing', cls: 'bg-sky-100 text-sky-800 ring-sky-200' },
  RESOLVED: { label: 'Resolved', cls: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  DISMISSED: { label: 'Dismissed', cls: 'bg-stone-200 text-stone-700 ring-stone-300' },
};
const targetLink = (r) => (r.targetType === 'RESOURCE' ? `/resources/${r.targetId}` : r.targetType === 'EMERGENCY' ? `/emergencies/${r.targetId}` : r.targetType === 'USER' ? `/users/${r.targetId}` : null);

function ReportsTab() {
  const [status, setStatus] = useState('PENDING');
  const [appealsOnly, setAppealsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const list = useFetch(() => api.get('/admin/reports', { status: appealsOnly ? undefined : status || undefined, appeal: appealsOnly ? 'PENDING' : undefined, page, limit: 10 }), [status, appealsOnly, page]);
  const [target, setTarget] = useState(null); // { report, mode: 'report' | 'appeal' }
  const [action, setAction] = useState('NONE');
  const [note, setNote] = useState('');
  const [reverse, setReverse] = useState(false);
  const [appealDecision, setAppealDecision] = useState('UPHELD');
  const [busy, setBusy] = useState(false);

  const open = (report, mode) => { setTarget({ report, mode }); setAction('NONE'); setNote(''); setReverse(false); setAppealDecision('UPHELD'); };
  const submit = async () => {
    setBusy(true);
    const body = target.mode === 'appeal'
      ? { appealDecision, note: note.trim() || undefined }
      : { status: action === 'NONE' ? 'DISMISSED' : 'RESOLVED', action, note: note.trim() || undefined, reverseRewards: reverse || undefined };
    await run(() => api.patch(`/admin/reports/${target.report._id}`, body), 'Decision recorded', list.reload);
    setBusy(false);
    setTarget(null);
  };
  const markReviewing = (r) => run(() => api.patch(`/admin/reports/${r._id}`, { status: 'REVIEWING' }), 'Marked as under review', list.reload);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs label="Report status" value={appealsOnly ? 'APPEALS' : status} onChange={(k) => { setPage(1); if (k === 'APPEALS') setAppealsOnly(true); else { setAppealsOnly(false); setStatus(k); } }}
          tabs={[{ key: 'PENDING', label: 'Pending' }, { key: 'REVIEWING', label: 'Reviewing' }, { key: 'RESOLVED', label: 'Resolved' }, { key: 'DISMISSED', label: 'Dismissed' }, { key: 'APPEALS', label: 'Appeals' }]} />
      </div>
      <Async state={list} empty={<EmptyState icon="flag" title="Nothing in this queue" text="Reports and appeals will show up here." />}>
        {(items) => (
          <ul className="space-y-4">
            {items.map((r) => (
              <li key={r._id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{r.targetType.toLowerCase()} · {REPORT_REASONS[r.reason] || r.reason}</p>
                    <p className="text-xs text-stone-500">Reported by {r.reporter?.name || 'someone'} · {timeAgo(r.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">{r.appeal?.status === 'PENDING' && <Badge cls="bg-saffron-100 text-saffron-700 ring-saffron-200">Appeal pending</Badge>}<StatusBadge status={r.status} map={REPORT_STATUS} /></div>
                </div>
                {r.description && <p className="mt-3 whitespace-pre-line rounded-lg bg-stone-50 p-3 text-sm">{r.description}</p>}
                <div className="mt-3 rounded-lg border border-stone-200 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Reported content</p>
                  {r.preview ? (
                    <p className="mt-1">
                      {r.preview.title && <strong>{r.preview.title}</strong>}
                      {r.preview.rating !== undefined && <span>{'★'.repeat(r.preview.rating)} {r.preview.comment}</span>}
                      {r.preview.status && <span className="ml-2 text-xs text-stone-500">({r.preview.status})</span>}
                      {targetLink(r) && <> · <Link className="link" to={targetLink(r)}>Open</Link></>}
                    </p>
                  ) : <p className="mt-1 text-stone-500">Content no longer exists.</p>}
                  {r.reportedUser && <p className="mt-1 text-xs text-stone-500">Account: {r.reportedUser.name} ({r.reportedUser.accountStatus?.toLowerCase()})</p>}
                </div>
                {r.adminDecision?.decidedAt && <p className="mt-3 text-sm text-stone-600"><strong>Decision:</strong> {r.adminDecision.action.replace(/_/g, ' ').toLowerCase()}{r.adminDecision.note ? ` — ${r.adminDecision.note}` : ''} <span className="text-xs text-stone-400">({fmtDateTime(r.adminDecision.decidedAt)})</span></p>}
                {r.appeal?.status && r.appeal.status !== 'NONE' && (
                  <div className="mt-3 rounded-lg border border-saffron-200 bg-saffron-50 p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-saffron-700">Appeal · {r.appeal.status.toLowerCase()}</p>
                    <p className="mt-1 whitespace-pre-line">{r.appeal.message}</p>
                    {r.appeal.note && <p className="mt-1 text-xs text-stone-600">Admin note: {r.appeal.note}</p>}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {r.status === 'PENDING' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => markReviewing(r)}>Mark as reviewing</button>}
                  {r.appeal?.status === 'PENDING' && <button type="button" className="btn btn-accent btn-sm" onClick={() => open(r, 'appeal')}>Decide appeal</button>}
                  {['PENDING', 'REVIEWING'].includes(r.status) && <button type="button" className="btn btn-primary btn-sm" onClick={() => open(r, 'report')}>Decide</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Async>
      <Pagination meta={list.meta} onPage={setPage} />

      <Modal open={!!target} onClose={() => setTarget(null)} title={target?.mode === 'appeal' ? 'Decide appeal' : 'Moderation decision'} size="max-w-md"
        footer={<><button type="button" className="btn btn-secondary" onClick={() => setTarget(null)}>Cancel</button><Button loading={busy} onClick={submit}>Record decision</Button></>}>
        <div className="space-y-4">
          {target?.mode === 'appeal' ? (
            <Field label="Outcome" hint="Overturning restores the content (and re-activates the account if it was suspended because of this report).">
              <select className="input" value={appealDecision} onChange={(e) => setAppealDecision(e.target.value)}>
                <option value="UPHELD">Uphold the original decision</option><option value="OVERTURNED">Overturn the decision</option>
              </select>
            </Field>
          ) : (
            <>
              <Field label="Action">
                <select className="input" value={action} onChange={(e) => setAction(e.target.value)}>
                  <option value="NONE">No action (dismiss)</option><option value="WARN">Warn the member</option><option value="HIDE_CONTENT">Hide the content</option><option value="SUSPEND_USER">Suspend the account</option>
                </select>
              </Field>
              {target?.report.targetType !== 'USER' && action !== 'NONE' && action !== 'WARN' && (
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={reverse} onChange={(e) => setReverse(e.target.checked)} />Also reverse reward points earned through this item (confirmed violation)</label>
              )}
            </>
          )}
          <Field label="Note (shown to the member)"><textarea className="input min-h-20" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------------------------- Listings ---------------------------------- */

function ListingsTab() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const list = useFetch(() => api.get('/admin/resources', { q: dq, status, page, limit: 12 }), [dq, status, page]);
  const [hide, setHide] = useState(null);

  return (
    <div>
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
        <input className="input" type="search" placeholder="Search listings" aria-label="Search listings" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className="input" aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Any status</option><option value="AVAILABLE">Available</option><option value="UNAVAILABLE">Fully allocated</option><option value="HIDDEN">Hidden</option>
        </select>
      </div>
      <Async state={list} empty={<EmptyState icon="box" title="No listings found" />}>
        {(items) => (
          <div className="card divide-y divide-stone-100">
            {items.map((r) => (
              <div key={r._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link to={`/resources/${r._id}`} className="link block truncate font-semibold">{r.title}</Link>
                  <p className="text-xs text-stone-500">{r.availabilityType.toLowerCase()} · by {r.owner?.name || 'unknown'} · {timeAgo(r.createdAt)}</p>
                  {r.status === 'HIDDEN' && r.hiddenReason && <p className="text-xs text-red-700">Hidden: {r.hiddenReason}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} map={RESOURCE_STATUS} />
                  {r.status === 'HIDDEN'
                    ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => run(() => api.patch(`/admin/resources/${r._id}/moderation`, { status: 'AVAILABLE' }), 'Listing restored', list.reload)}>Restore</button>
                    : <button type="button" className="btn btn-danger btn-sm" onClick={() => setHide(r)}>Hide</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Async>
      <Pagination meta={list.meta} onPage={setPage} />
      <NoteDialog open={!!hide} onClose={() => setHide(null)} title={`Hide “${hide?.title || ''}”?`} label="Reason (shown to the owner)" required danger confirmLabel="Hide listing"
        onSubmit={async (note) => { await run(() => api.patch(`/admin/resources/${hide._id}/moderation`, { status: 'HIDDEN', reason: note }), 'Listing hidden', list.reload); setHide(null); }} />
    </div>
  );
}

/* --------------------------------- Emergencies --------------------------------- */

function EmergenciesTab() {
  const list = useFetch(() => api.get('/admin/emergencies'), []);
  const [close, setClose] = useState(null);
  const setStatus = (e, status, note) => run(() => api.patch(`/emergencies/${e._id}/status`, { status, note: note || undefined }), `Marked ${status.replace('_', ' ').toLowerCase()}`, list.reload);

  return (
    <div>
      <p className="mb-4 text-sm text-stone-600">Active community requests. Move a suspicious request to “under review” to take it out of the public list while you check it, or close it.</p>
      <Async state={list} empty={<EmptyState icon="alert" title="No active emergency requests" />}>
        {(items) => (
          <div className="card divide-y divide-stone-100">
            {items.map((e) => (
              <div key={e._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link to={`/emergencies/${e._id}`} className="link block truncate font-semibold">{e.title}</Link>
                  <p className="text-xs text-stone-500">{URGENCY[e.urgency]?.label || e.urgency} · by {e.creator?.name || 'unknown'} · {timeAgo(e.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={e.status} map={EMERGENCY_STATUS} />
                  {e.status === 'UNDER_REVIEW'
                    ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatus(e, 'OPEN')}>Reopen</button>
                    : <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatus(e, 'UNDER_REVIEW')}>Review</button>}
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => setClose(e)}>Close</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Async>
      <NoteDialog open={!!close} onClose={() => setClose(null)} title={`Close “${close?.title || ''}”?`} label="Reason" required danger confirmLabel="Close request"
        onSubmit={async (note) => { await setStatus(close, 'CLOSED', note); setClose(null); }} />
    </div>
  );
}

/* ---------------------------------- Categories ---------------------------------- */

function CategoriesTab() {
  const list = useFetch(() => api.get('/admin/categories'), []);
  const [edit, setEdit] = useState(null); // null | {} (new) | category
  const [del, setDel] = useState(null);
  const [form, setForm] = useState({ name: '', subcategories: '' });
  const [busy, setBusy] = useState(false);

  const openEdit = (c) => { setEdit(c); setForm({ name: c.name || '', subcategories: (c.subcategories || []).join(', ') }); };
  const save = async () => {
    setBusy(true);
    const body = { name: form.name.trim(), subcategories: form.subcategories.split(',').map((s) => s.trim()).filter(Boolean) };
    await run(() => (edit._id ? api.patch(`/admin/categories/${edit._id}`, body) : api.post('/admin/categories', body)), 'Category saved', list.reload);
    setBusy(false);
    setEdit(null);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-stone-600">Categories control what members can choose when listing a resource.</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => openEdit({})}>Add category</button>
      </div>
      <Async state={list} empty={<EmptyState icon="list" title="No categories" />}>
        {(items) => (
          <div className="card divide-y divide-stone-100">
            {items.map((c) => (
              <div key={c._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{c.name} {!c.active && <Badge>Inactive</Badge>}</p>
                  <p className="truncate text-xs text-stone-500">{c.slug}{c.subcategories?.length ? ` · ${c.subcategories.join(', ')}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => run(() => api.patch(`/admin/categories/${c._id}`, { active: !c.active }), c.active ? 'Category deactivated' : 'Category activated', list.reload)}>{c.active ? 'Deactivate' : 'Activate'}</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button>
                  <button type="button" className="btn btn-ghost btn-sm text-red-700" onClick={() => setDel(c)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Async>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?._id ? 'Edit category' : 'New category'} size="max-w-md"
        footer={<><button type="button" className="btn btn-secondary" onClick={() => setEdit(null)}>Cancel</button><Button loading={busy} disabled={form.name.trim().length < 2} onClick={save}>Save</Button></>}>
        <div className="space-y-4">
          <Field label="Name" required><input className="input" maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Subcategories" hint="Comma separated, optional."><input className="input" value={form.subcategories} onChange={(e) => setForm({ ...form, subcategories: e.target.value })} /></Field>
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title={`Delete “${del?.name || ''}”?`} text="Categories that are used by listings can’t be deleted — deactivate them instead." confirmLabel="Delete"
        onConfirm={async () => { await run(() => api.delete(`/admin/categories/${del._id}`), 'Category deleted', list.reload); setDel(null); }} />
    </div>
  );
}

/* ------------------------------------ Page ------------------------------------ */

export default function AdminModeration() {
  const [tab, setTab] = useState('reports');
  return (
    <div>
      <PageHeader title="Content moderation" subtitle="Review reports and appeals, hide unsafe listings, watch emergency requests and manage categories." />
      <Tabs label="Moderation sections" value={tab} onChange={setTab} tabs={[{ key: 'reports', label: 'Reports & appeals' }, { key: 'listings', label: 'Listings' }, { key: 'emergencies', label: 'Emergencies' }, { key: 'categories', label: 'Categories' }]} />
      {tab === 'reports' && <ReportsTab />}
      {tab === 'listings' && <ListingsTab />}
      {tab === 'emergencies' && <EmergenciesTab />}
      {tab === 'categories' && <CategoriesTab />}
    </div>
  );
}
