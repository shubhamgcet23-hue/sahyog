import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import MapView from '../components/MapView';
import ReportDialog from '../components/ReportDialog';
import { Async, Badge, Button, Field, NoteDialog, PageHeader, SafetyNotice, StatusBadge, UserChip, VerifiedBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { api, errMsg } from '../services/api';
import { EMERGENCY_CATEGORIES, EMERGENCY_STATUS, URGENCY } from '../utils/constants';
import { coordsOf, fmtDateTime, imgSrc, timeAgo } from '../utils/format';

const RESPONSE_CLS = { OFFERED: 'bg-amber-100 text-amber-800 ring-amber-200', ACCEPTED: 'bg-emerald-100 text-emerald-800 ring-emerald-200', DECLINED: 'bg-stone-200 text-stone-700 ring-stone-300', WITHDRAWN: 'bg-stone-200 text-stone-700 ring-stone-300' };

export default function EmergencyDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const state = useFetch(() => api.get(`/emergencies/${id}`), [id]);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState({ message: '', quantity: '' });

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); setDialog(null); state.reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const setStatus = (status, note) => run(() => api.patch(`/emergencies/${id}/status`, { status, note: note || undefined }), `Marked ${status.toLowerCase().replace('_', ' ')}`);
  const answer = (rid, status) => run(() => api.patch(`/emergencies/${id}/responses/${rid}`, { status }), status === 'ACCEPTED' ? 'Offer accepted' : status === 'DECLINED' ? 'Offer declined' : 'Offer withdrawn');
  const sendOffer = (e) => {
    e.preventDefault();
    if (offer.message.trim().length < 5) { toast.error('Please describe what you can offer (at least 5 characters)'); return; }
    run(async () => { await api.post(`/emergencies/${id}/respond`, { message: offer.message.trim(), quantity: offer.quantity || undefined }); setOffer({ message: '', quantity: '' }); }, 'Offer sent — the requester has been notified');
  };

  return (
    <div className="container-page max-w-5xl py-8">
      <Async state={state}>
        {({ emergency: e }) => {
          const isCreator = 
            Boolean(user && e && e.creator) &&
            String(e.creator._id ?? e.creator) === String(user._id);
          const isAdmin = user?.role === 'ADMIN';
          const u = URGENCY[e.urgency];
          const place = coordsOf(e.location);
          const open = ['OPEN', 'MATCHED'].includes(e.status);
          const canOffer = user && !isCreator && !isAdmin && open && !(e.myResponse && ['OFFERED', 'ACCEPTED'].includes(e.myResponse.status));
          const responses = e.responses || [];
          const hasAccepted = responses.some((r) => r.status === 'ACCEPTED');
          return (
            <>
              <PageHeader eyebrow="Emergency request" title={e.title}
                actions={<><Badge cls={u?.cls}>{u?.label} urgency</Badge><StatusBadge status={e.status} map={EMERGENCY_STATUS} />{e.isCampaign && <VerifiedBadge />}</>} />
              <div className="mb-6"><SafetyNotice compact /></div>

              <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                  <section className="card p-5">
                    <p className="whitespace-pre-line text-stone-800">{e.description}</p>
                    {e.images?.length > 0 && <ul className="mt-4 flex flex-wrap gap-3">{e.images.map((im) => <li key={im.url}><a href={imgSrc(im)} target="_blank" rel="noreferrer"><img src={imgSrc(im)} alt="Supporting" className="h-28 w-28 rounded-xl object-cover" /></a></li>)}</ul>}
                    <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-stone-100 pt-4 text-sm sm:grid-cols-4">
                      <div><dt className="text-stone-500">Category</dt><dd className="font-medium">{EMERGENCY_CATEGORIES[e.category]}</dd></div>
                      <div><dt className="text-stone-500">Quantity</dt><dd className="font-medium">{e.quantity || '—'}</dd></div>
                      <div><dt className="text-stone-500">Area</dt><dd className="font-medium">{e.areaLabel || 'Nearby'}</dd></div>
                      <div><dt className="text-stone-500">Posted</dt><dd className="font-medium">{timeAgo(e.createdAt)}</dd></div>
                    </dl>
                    {e.contactPreference?.notes && <p className="mt-3 text-sm text-stone-600"><strong>Coordination:</strong> {e.contactPreference.notes}</p>}
                    {e.creatorPhone && <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><Icon name="phone" className="h-4 w-4" />{isCreator ? 'Your phone number (shared with accepted helpers only):' : 'Contact:'} <a className="font-semibold underline" href={`tel:${e.creatorPhone}`}>{e.creatorPhone}</a></p>}
                  </section>

                  {place && <section><MapView className="h-64" center={place} zoom={13} markers={[]} area={{ ...place, radiusKm: 1 }} /><p className="mt-1.5 text-xs text-stone-500">Shaded area is approximate (about 1 km). The exact address is never published.</p></section>}

                  {(isCreator || isAdmin) && (
                    <section className="card p-5">
                      <h2 className="mb-3 text-lg">Offers of help ({responses.length})</h2>
                      {responses.length === 0 ? <p className="text-sm text-stone-500">No offers yet. You’ll be notified as soon as someone responds.</p> : (
                        <ul className="space-y-3">
                          {responses.map((r) => (
                            <li key={r._id} className="rounded-xl border border-stone-200 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2"><UserChip user={r.responder} /><Badge cls={RESPONSE_CLS[r.status]}>{r.status.toLowerCase()}</Badge></div>
                              <p className="mt-2 text-sm">{r.message}{r.quantity ? ` (offering ${r.quantity})` : ''}</p>
                              <p className="mt-1 text-xs text-stone-400">{fmtDateTime(r.createdAt)}</p>
                              {isCreator && r.status === 'OFFERED' && open && (
                                <div className="mt-2 flex gap-2"><Button size="sm" loading={busy} onClick={() => answer(r._id, 'ACCEPTED')}>Accept</Button><button type="button" className="btn btn-secondary btn-sm" onClick={() => answer(r._id, 'DECLINED')}>Decline</button></div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )}

                  {user && !isCreator && !isAdmin && e.myResponse && (
                    <section className="card border-brand-200 bg-brand-50 p-5">
                      <h2 className="text-lg">Your offer</h2>
                      <p className="mt-1 text-sm">{e.myResponse.message}</p>
                      <p className="mt-2 flex items-center gap-2 text-sm"><Badge cls={RESPONSE_CLS[e.myResponse.status]}>{e.myResponse.status.toLowerCase()}</Badge>
                        {e.myResponse.status === 'OFFERED' && <button type="button" className="link" onClick={() => answer(e.myResponse._id, 'WITHDRAWN')}>Withdraw</button>}
                        {e.myResponse.status === 'ACCEPTED' && <span className="text-emerald-800">Accepted — please coordinate with the requester{e.creatorPhone ? ' using the phone number above' : ' as they instruct'}.</span>}</p>
                    </section>
                  )}

                  {canOffer && (
                    <form onSubmit={sendOffer} className="card space-y-4 p-5">
                      <h2 className="text-lg">I can help</h2>
                      <Field label="What can you offer?" required hint="Be specific, and don’t share bank details or OTPs."><textarea className="input min-h-24" maxLength={600} value={offer.message} onChange={(ev) => setOffer({ ...offer, message: ev.target.value })} /></Field>
                      <Field label="Quantity (optional)" className="max-w-[10rem]"><input type="number" min="1" className="input" value={offer.quantity} onChange={(ev) => setOffer({ ...offer, quantity: ev.target.value })} /></Field>
                      <Button type="submit" loading={busy}>Send offer</Button>
                    </form>
                  )}
                  {!user && open && <div className="card p-5 text-center"><p className="mb-3 text-stone-700">Sign in to offer help on this request.</p><Link to="/login" state={{ from: `/emergencies/${id}` }} className="btn btn-primary">Sign in</Link></div>}
                </div>

                <aside className="space-y-4">
                  <div className="card p-5"><h2 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wider text-stone-500">Requested by</h2><UserChip user={e.creator} /></div>

                  {(isCreator || isAdmin) && (
                    <div className="card space-y-2 p-5">
                      <h2 className="mb-1 font-sans text-sm font-semibold uppercase tracking-wider text-stone-500">Manage</h2>
                      {isCreator && e.status === 'MATCHED' && <Button className="w-full" loading={busy} onClick={() => setStatus('FULFILLED')} disabled={!hasAccepted}>Mark as fulfilled</Button>}
                      {isCreator && e.status === 'MATCHED' && <button type="button" className="btn btn-secondary w-full" onClick={() => setStatus('OPEN')}>Reopen for more offers</button>}
                      {isAdmin && e.status === 'OPEN' && <button type="button" className="btn btn-secondary w-full" onClick={() => setStatus('UNDER_REVIEW', 'Under moderator review')}>Move to under review</button>}
                      {isAdmin && e.status === 'UNDER_REVIEW' && <button type="button" className="btn btn-secondary w-full" onClick={() => setStatus('OPEN', 'Approved by moderator')}>Approve &amp; reopen</button>}
                      {e.status !== 'CLOSED' && <button type="button" className="btn btn-secondary w-full !text-red-700" onClick={() => setDialog('close')}>Close request</button>}
                      {e.status === 'CLOSED' && <p className="text-xs text-stone-500">This request is closed.</p>}
                    </div>
                  )}

                  <div className="card p-5">
                    <h2 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wider text-stone-500">Timeline</h2>
                    <ol className="space-y-2 border-l-2 border-brand-100 pl-4 text-sm">{(e.statusHistory || []).map((h, i) => <li key={i}><p className="font-semibold">{EMERGENCY_STATUS[h.status]?.label || h.status}</p><p className="text-xs text-stone-500">{fmtDateTime(h.at)}{h.note ? ` — ${h.note}` : ''}</p></li>)}</ol>
                  </div>
                  {user && !isCreator && <button type="button" className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-red-700" onClick={() => setDialog('report')}><Icon name="flag" className="h-3.5 w-3.5" />Report this request</button>}
                </aside>
              </div>

              <NoteDialog open={dialog === 'close'} onClose={() => setDialog(null)} onSubmit={(n) => setStatus('CLOSED', n)} title="Close this request" label="Reason (optional)" confirmLabel="Close request" danger />
              <ReportDialog open={dialog === 'report'} onClose={() => setDialog(null)} targetType="EMERGENCY" targetId={e._id} label="emergency request" />
            </>
          );
        }}
      </Async>
    </div>
  );
}
