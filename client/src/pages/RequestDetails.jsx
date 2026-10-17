import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import ReportDialog from '../components/ReportDialog';
import { Async, Badge, Button, ConfirmDialog, Field, NoteDialog, PageHeader, StarInput, StatusBadge, TypeBadge, UserChip } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { api, errMsg } from '../services/api';
import { INTENDED_USE, REQUEST_STATUS } from '../utils/constants';
import { fmtDate, fmtDateTime, imgSrc } from '../utils/format';

export default function RequestDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const state = useFetch(() => api.get(`/requests/${id}`), [id]);
  const pending = useFetch(() => api.get('/users/me/pending-reviews'), [id, state.data?.request?.status]);
  const [dialog, setDialog] = useState(null); // 'decline' | 'cancel' | 'complete' | 'report'
  const [busy, setBusy] = useState(false);

  const move = async (status, note) => {
    setBusy(true);
    try {
      await api.patch(`/requests/${id}/status`, { status, note: note || undefined });
      toast.success({ APPROVED: 'Request approved — contact details unlocked', REJECTED: 'Request declined', IN_PROGRESS: 'Handover started', COMPLETED: 'Exchange completed 🎉', CANCELLED: 'Request cancelled' }[status]);
      setDialog(null);
      state.reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const chat = async () => {
    try { const { data } = await api.post('/conversations', { requestId: id }); nav(`/messages/${data.conversation._id}`); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="container-page max-w-4xl py-8">
      <Async state={state}>
        {({ request: r, ...rest }) => {
          const req = state.data.request || r;
          const isOwner = String(req.owner?._id) === String(user?._id);
          const isRequester = String(req.requester?._id) === String(user?._id);
          const other = isOwner ? req.requester : req.owner;
          const s = req.status;
          const borrow = req.requestType === 'BORROW';
          const canComplete = isOwner && (borrow ? s === 'IN_PROGRESS' : ['APPROVED', 'IN_PROGRESS'].includes(s));
          const canCancel = (isRequester && ['PENDING', 'APPROVED', 'IN_PROGRESS'].includes(s)) || (isOwner && ['APPROVED', 'IN_PROGRESS'].includes(s));
          const needsReview = s === 'COMPLETED' && (pending.data || []).some((p) => String(p._id) === String(req._id));
          const src = imgSrc(req.resource?.images?.[0]);
          const contact = state.data.request ? state.data.request.contact : rest.contact;
          return (
            <>
              <PageHeader eyebrow={`${borrow ? 'Borrow' : req.requestType === 'DONATE' ? 'Donation' : 'Share'} request`} title={req.resource?.title || 'Request'}
                actions={<><StatusBadge status={s} />{req.isOverdue && <Badge cls="bg-red-600 text-white ring-red-700"><Icon name="clock" className="h-3 w-3" />Overdue</Badge>}</>} />

              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-6 md:col-span-2">
                  <section className="card p-5">
                    <Link to={`/resources/${req.resource?._id}`} className="flex items-center gap-4 hover:underline">
                      {src ? <img src={src} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-xl bg-brand-50 text-3xl" aria-hidden="true">📦</span>}
                      <div><p className="font-semibold">{req.resource?.title}</p><p className="text-sm text-stone-600">{req.resource?.areaLabel}</p><TypeBadge type={req.requestType} /></div>
                    </Link>
                    <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                      <div><dt className="text-stone-500">Quantity</dt><dd className="font-medium">{req.quantity}</dd></div>
                      <div><dt className="text-stone-500">Intended use</dt><dd className="font-medium">{INTENDED_USE[req.intendedUse] || '—'}</dd></div>
                      <div><dt className="text-stone-500">Handover</dt><dd className="font-medium">{req.handoverMethod === 'DELIVERY' ? 'Delivery' : 'Pickup'}</dd></div>
                      {borrow && <div><dt className="text-stone-500">Return by</dt><dd className={req.isOverdue ? 'font-semibold text-red-700' : 'font-medium'}>{fmtDate(req.proposedReturnDate)}</dd></div>}
                      {req.handoverNotes && <div className="col-span-2"><dt className="text-stone-500">Preferred time / place</dt><dd className="font-medium">{req.handoverNotes}</dd></div>}
                      {req.message && <div className="col-span-2"><dt className="text-stone-500">Message</dt><dd className="whitespace-pre-line rounded-xl bg-stone-50 p-3">{req.message}</dd></div>}
                    </dl>
                  </section>

                  {contact && (contact.requesterPhone || contact.ownerPhone || contact.pickupDetails) && (
                    <section className="card border-emerald-200 bg-emerald-50 p-5">
                      <h2 className="flex items-center gap-2 font-sans text-base font-semibold text-emerald-900"><Icon name="shield" className="h-4 w-4" />Contact details (unlocked after approval)</h2>
                      <ul className="mt-2 space-y-1 text-sm text-emerald-900">
                        {contact.pickupDetails && <li><strong>Pickup details:</strong> {contact.pickupDetails}</li>}
                        {(isOwner ? contact.requesterPhone : contact.ownerPhone) && <li className="flex items-center gap-1.5"><Icon name="phone" className="h-4 w-4" /><a className="font-semibold underline" href={`tel:${isOwner ? contact.requesterPhone : contact.ownerPhone}`}>{isOwner ? contact.requesterPhone : contact.ownerPhone}</a></li>}
                      </ul>
                    </section>
                  )}

                  <section className="card p-5">
                    <h2 className="mb-4 text-lg">Timeline</h2>
                    <ol className="relative space-y-4 border-l-2 border-brand-100 pl-5">
                      {(req.statusHistory || []).map((h, i) => (
                        <li key={i} className="relative">
                          <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
                          <p className="text-sm font-semibold">{REQUEST_STATUS[h.status]?.label || h.status}</p>
                          <p className="text-xs text-stone-500">{fmtDateTime(h.at)}</p>
                          {h.note && <p className="mt-0.5 text-sm text-stone-600">“{h.note}”</p>}
                        </li>
                      ))}
                    </ol>
                  </section>

                  {needsReview && <ReviewForm requestId={req._id} reviewee={other} onDone={() => { pending.reload(); }} />}
                </div>

                <aside className="space-y-4">
                  <div className="card p-5">
                    <h2 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wider text-stone-500">{isOwner ? 'Requester' : 'Owner'}</h2>
                    <UserChip user={other} />
                    {isOwner ? null : <p className="mt-2 text-xs text-stone-500">Trust score {other?.trustScore}</p>}
                  </div>

                  <div className="card space-y-2 p-5">
                    <h2 className="mb-1 font-sans text-sm font-semibold uppercase tracking-wider text-stone-500">Actions</h2>
                    {isOwner && s === 'PENDING' && (
                      <>
                        <Button className="w-full" loading={busy} onClick={() => move('APPROVED')}>Approve request</Button>
                        <button type="button" className="btn btn-secondary w-full" onClick={() => setDialog('decline')}>Decline</button>
                      </>
                    )}
                    {isOwner && s === 'APPROVED' && <Button className="w-full" loading={busy} onClick={() => move('IN_PROGRESS')}>Start handover</Button>}
                    {canComplete && <button type="button" className="btn btn-primary w-full" onClick={() => setDialog('complete')}>{borrow ? 'Confirm item returned' : 'Confirm completed'}</button>}
                    {canCancel && <button type="button" className="btn btn-secondary w-full !text-red-700" onClick={() => setDialog('cancel')}>Cancel request</button>}
                    {!['REJECTED', 'CANCELLED'].includes(s) && <button type="button" className="btn btn-ghost w-full" onClick={chat}><Icon name="message" className="h-4 w-4" />Message {isOwner ? 'requester' : 'owner'}</button>}
                    {['REJECTED', 'CANCELLED', 'COMPLETED'].includes(s) && <p className="text-xs text-stone-500">This request is closed.</p>}
                    {isRequester && s === 'PENDING' && <p className="text-xs text-stone-500">Waiting for the owner to respond.</p>}
                    {isRequester && s === 'APPROVED' && <p className="text-xs text-stone-500">Approved! Message the owner to arrange the handover.</p>}
                  </div>
                  {(isOwner || isRequester) && <button type="button" className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-red-700" onClick={() => setDialog('report')}><Icon name="flag" className="h-3.5 w-3.5" />Report a problem with this exchange</button>}
                </aside>
              </div>

              <NoteDialog open={dialog === 'decline'} onClose={() => setDialog(null)} onSubmit={(n) => move('REJECTED', n)} title="Decline this request" label="Reason (shared with the requester)" confirmLabel="Decline" danger />
              <NoteDialog open={dialog === 'cancel'} onClose={() => setDialog(null)} onSubmit={(n) => move('CANCELLED', n)} title="Cancel this request" label="Reason (optional)" confirmLabel="Cancel request" danger />
              <ConfirmDialog open={dialog === 'complete'} onClose={() => setDialog(null)} onConfirm={() => move('COMPLETED')} loading={busy} confirmLabel={borrow ? 'Yes, it was returned' : 'Yes, it’s done'} title={borrow ? 'Confirm the item was returned?' : 'Confirm this exchange is complete?'} text="This closes the exchange, updates stock, awards points to eligible participants (once), and lets both of you leave reviews." />
              <ReportDialog open={dialog === 'report'} onClose={() => setDialog(null)} targetType="USER" targetId={other?._id} label="member" />
            </>
          );
        }}
      </Async>
    </div>
  );
}

function ReviewForm({ requestId, reviewee, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!rating) { setError('Choose a star rating'); return; }
    setBusy(true); setError('');
    try { await api.post('/reviews', { requestId, rating, comment: comment.trim() || undefined }); toast.success('Thanks for your review!'); onDone(); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <section className="card border-saffron-200 bg-saffron-50 p-5">
      <h2 className="text-lg">How did it go with {reviewee?.organizationDetails?.orgName || reviewee?.name}?</h2>
      <div className="mt-3"><StarInput value={rating} onChange={setRating} label="Your rating" /></div>
      <Field label="Comment (optional)" className="mt-3"><textarea className="input min-h-20 bg-white" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Punctual, friendly, item as described…" /></Field>
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
      <Button className="mt-3" loading={busy} onClick={submit}>Submit review</Button>
    </section>
  );
}
