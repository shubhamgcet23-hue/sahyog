import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import { Async, Badge, ConfirmDialog, EmptyState, PageHeader, Pagination, StatusBadge, TypeBadge } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { api, errMsg } from '../services/api';
import { CATEGORY_EMOJI, RESOURCE_STATUS } from '../utils/constants';
import { imgSrc, timeAgo } from '../utils/format';

export default function MyListings() {
  const [sp, setSp] = useSearchParams();
  const page = Number(sp.get('page') || 1);
  const state = useFetch(() => api.get('/users/me/resources', { page, limit: 12 }), [page]);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try { await api.delete(`/resources/${del._id}`); toast.success('Listing deleted'); setDel(null); state.reload(); } catch (e) { toast.error(errMsg(e)); setDel(null); } finally { setBusy(false); }
  };

  return (
    <div className="container-page max-w-4xl py-8">
      <PageHeader eyebrow="Your items" title="My listings" subtitle="Everything you’re sharing with the community." actions={<Link to="/resources/new" className="btn btn-accent"><Icon name="plus" className="h-4 w-4" />New listing</Link>} />
      <Async state={state} empty={<EmptyState icon="box" title="You haven’t listed anything yet" text="That spare drill, the old textbooks, a wheelchair — someone nearby needs it." action={<Link to="/resources/new" className="btn btn-primary">Share your first resource</Link>} />}>
        {(items) => (
          <ul className="space-y-3">
            {items.map((r) => {
              const src = imgSrc(r.images?.[0]);
              return (
                <li key={r._id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <Link to={`/resources/${r._id}`} className="flex min-w-0 flex-1 items-center gap-4">
                    {src ? <img src={src} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-brand-50 text-3xl" aria-hidden="true">{CATEGORY_EMOJI[r.category] || '📦'}</span>}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.title}</p>
                      <p className="text-sm text-stone-600">{r.availableQuantity} of {r.quantity} available · listed {timeAgo(r.createdAt)}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5"><TypeBadge type={r.availabilityType} /><StatusBadge status={r.status} map={RESOURCE_STATUS} />{r.pendingRequests > 0 && <Badge cls="bg-saffron-100 text-saffron-700 ring-saffron-200">{r.pendingRequests} pending request{r.pendingRequests > 1 ? 's' : ''}</Badge>}</div>
                    </div>
                  </Link>
                  <div className="flex flex-wrap gap-2">
                    {r.pendingRequests > 0 && <Link to="/requests?tab=received&status=PENDING" className="btn btn-primary btn-sm">Review</Link>}
                    <Link to={`/resources/${r._id}/edit`} className="btn btn-secondary btn-sm"><Icon name="edit" className="h-3.5 w-3.5" />Edit</Link>
                    <button type="button" className="btn btn-secondary btn-sm !text-red-700" onClick={() => setDel(r)} aria-label={`Delete ${r.title}`}><Icon name="trash" className="h-3.5 w-3.5" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Async>
      <Pagination meta={state.meta} onPage={(p) => setSp(p > 1 ? { page: String(p) } : {})} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} loading={busy} danger confirmLabel="Delete" title={`Delete “${del?.title}”?`} text="Pending requests are cancelled. Listings with approved or in-progress exchanges can’t be deleted until they finish." />
    </div>
  );
}
