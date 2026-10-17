import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import MapView from '../components/MapView';
import ReportDialog from '../components/ReportDialog';
import { Async, Badge, ConfirmDialog, StatusBadge, TrustBadge, TypeBadge, UserChip, VerifiedBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { api, errMsg } from '../services/api';
import { CATEGORY_EMOJI, CONDITIONS, REQUEST_STATUS, RESOURCE_STATUS, TYPE_META, cn } from '../utils/constants';
import { coordsOf, fmtDate, imgSrc, isVerifiedOrg, orgName } from '../utils/format';

export default function ResourceDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const state = useFetch(() => api.get(`/resources/${id}`), [id]);
  const categories = useFetch(() => api.get('/categories'), []);
  const [active, setActive] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try { await api.delete(`/resources/${id}`); toast.success('Listing deleted'); nav('/my-listings'); } catch (e) { toast.error(errMsg(e)); setConfirmDelete(false); } finally { setBusy(false); }
  };

  return (
    <div className="container-page py-8">
      <Async state={state}>
        {(r) => {
          const owner = user && String(r.owner?._id) === String(user._id);
          const type = TYPE_META[r.availabilityType];
          const c = coordsOf(r.location);
          const catName = categories.data?.find((x) => x.slug === r.category)?.name || r.category;
          const openReq = r.viewerRequest && ['PENDING', 'APPROVED', 'IN_PROGRESS'].includes(r.viewerRequest.status);
          const canRequest = r.status === 'AVAILABLE' && r.availableQuantity > 0;
          const imgs = r.images || [];
          return (
            <>
              <nav className="mb-4 text-sm text-stone-500" aria-label="Breadcrumb"><Link to="/discover" className="hover:underline">Discover</Link> / <span className="text-stone-800">{r.title}</span></nav>
              <div className="grid gap-8 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <div className="overflow-hidden rounded-2xl border border-stone-200 bg-gradient-to-br from-brand-50 to-saffron-50">
                    {imgs[active] ? <img src={imgSrc(imgs[active])} alt={`${r.title}, photo ${active + 1}`} className="aspect-[4/3] w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center text-8xl" aria-hidden="true">{CATEGORY_EMOJI[r.category] || '📦'}</div>}
                  </div>
                  {imgs.length > 1 && (
                    <ul className="mt-3 flex gap-2 overflow-x-auto">
                      {imgs.map((im, i) => (
                        <li key={im.url}><button type="button" onClick={() => setActive(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === active} className={cn('h-16 w-20 overflow-hidden rounded-lg border-2', i === active ? 'border-brand-500' : 'border-transparent opacity-70 hover:opacity-100')}><img src={imgSrc(im)} alt="" className="h-full w-full object-cover" /></button></li>
                      ))}
                    </ul>
                  )}

                  <section className="mt-8">
                    <h2 className="text-xl">About this item</h2>
                    <p className="mt-2 whitespace-pre-line text-stone-700">{r.description}</p>
                  </section>

                  <section className="mt-8">
                    <h2 className="text-xl">Approximate location</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-600"><Icon name="pin" className="h-4 w-4 text-brand-600" />{r.areaLabel || 'Nearby'} — the circle covers roughly 1 km around the item.</p>
                    {c && <div className="mt-3"><MapView className="h-64" center={c} zoom={13} markers={[{ id: r._id, ...c, color: type?.color }]} area={{ ...c, radiusKm: 0.8 }} fit={false} /></div>}
                    {r.addressDetail && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><strong>Pickup details{owner ? '' : ' (unlocked)'}:</strong> {r.addressDetail}</p>}
                    {!r.addressDetail && !owner && <p className="mt-3 text-xs text-stone-500">Exact pickup details are shared once the owner approves your request.</p>}
                  </section>
                </div>

                <aside className="space-y-4 lg:col-span-2">
                  <div className="card p-5">
                    <div className="flex flex-wrap gap-2"><TypeBadge type={r.availabilityType} />{r.status !== 'AVAILABLE' && <StatusBadge status={r.status} map={RESOURCE_STATUS} />}</div>
                    <h1 className="mt-3 text-3xl">{r.title}</h1>
                    <p className="mt-1 text-sm text-stone-600">{type?.blurb}</p>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-stone-500">Category</dt><dd className="font-medium">{catName}{r.subcategory ? ` · ${r.subcategory}` : ''}</dd></div>
                      <div><dt className="text-stone-500">Condition</dt><dd className="font-medium">{CONDITIONS[r.condition]}</dd></div>
                      <div><dt className="text-stone-500">Available</dt><dd className="font-medium">{r.availableQuantity} of {r.quantity}</dd></div>
                      <div><dt className="text-stone-500">Listed</dt><dd className="font-medium">{fmtDate(r.createdAt)}</dd></div>
                      {(r.availabilityDates?.from || r.availabilityDates?.to) && <div className="col-span-2"><dt className="text-stone-500">Available window</dt><dd className="font-medium">{fmtDate(r.availabilityDates.from)} → {fmtDate(r.availabilityDates.to)}</dd></div>}
                    </dl>

                    <div className="mt-5 space-y-2">
                      {owner ? (
                        <>
                          <Link to={`/resources/${r._id}/edit`} className="btn btn-primary w-full"><Icon name="edit" className="h-4 w-4" />Edit listing</Link>
                          <button type="button" className="btn btn-secondary w-full !text-red-700" onClick={() => setConfirmDelete(true)}><Icon name="trash" className="h-4 w-4" />Delete listing</button>
                          <Link to="/requests?tab=received" className="btn btn-ghost w-full">View requests for my items</Link>
                        </>
                      ) : !user ? (
                        <Link to="/login" state={{ from: `/resources/${r._id}` }} className="btn btn-primary w-full">Sign in to request</Link>
                      ) : user.role === 'ADMIN' ? (
                        <p className="text-sm text-stone-500">Administrators moderate listings from the admin area.</p>
                      ) : openReq ? (
                        <>
                          <p className="flex items-center gap-2 text-sm">Your request: <Badge cls={REQUEST_STATUS[r.viewerRequest.status].cls}>{REQUEST_STATUS[r.viewerRequest.status].label}</Badge></p>
                          <Link to={`/requests/${r.viewerRequest._id}`} className="btn btn-primary w-full">View your request</Link>
                        </>
                      ) : canRequest ? (
                        <Link to={`/resources/${r._id}/request`} className="btn btn-primary btn-lg w-full">{r.availabilityType === 'BORROW' ? 'Request to borrow' : r.availabilityType === 'DONATE' ? 'Request this item' : 'Request to share'}</Link>
                      ) : (
                        <p className="rounded-xl bg-stone-100 p-3 text-sm text-stone-600">This resource isn’t available right now.</p>
                      )}
                    </div>
                  </div>

                  <div className="card p-5">
                    <h2 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wider text-stone-500">Shared by</h2>
                    <div className="flex items-center justify-between gap-2">
                      <UserChip user={r.owner} />
                      <TrustBadge score={r.owner?.trustScore} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                      {isVerifiedOrg(r.owner) && <VerifiedBadge />}
                      {r.owner?.role === 'ORGANIZATION' && <span>{orgName(r.owner)}</span>}
                    </div>
                    {!owner && user && <button type="button" className="mt-4 flex items-center gap-1.5 text-xs text-stone-500 hover:text-red-700" onClick={() => setReportOpen(true)}><Icon name="flag" className="h-3.5 w-3.5" />Report this listing</button>}
                  </div>
                </aside>
              </div>

              <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={remove} loading={busy} danger confirmLabel="Delete listing" title="Delete this listing?" text="Pending requests will be cancelled. This can’t be undone. Listings with approved or in-progress exchanges can’t be deleted until those finish." />
              <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType="RESOURCE" targetId={r._id} label="listing" />
            </>
          );
        }}
      </Async>
    </div>
  );
}
