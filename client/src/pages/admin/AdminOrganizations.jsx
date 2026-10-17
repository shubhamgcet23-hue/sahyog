import { useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '../../components/Icon';
import { Async, Badge, EmptyState, NoteDialog, PageHeader } from '../../components/ui';
import { useFetch } from '../../hooks/useFetch';
import { api, errMsg } from '../../services/api';
import { ORG_TYPES } from '../../utils/constants';
import { fmtDate, imgSrc, timeAgo } from '../../utils/format';

/** Organization verification queue — approve or decline applications. The decision is audited and the organization is notified. */
export default function AdminOrganizations() {
  const pending = useFetch(() => api.get('/admin/organizations/pending'), []);
  const [decision, setDecision] = useState(null); // { app, decision }

  const decide = async (note) => {
    const { app, decision: d } = decision;
    try {
      await api.patch(`/admin/organizations/${app.organization._id}/verification`, { decision: d, note: note || undefined });
      toast.success(d === 'APPROVED' ? 'Organization verified' : 'Application declined');
      setDecision(null);
      pending.reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader title="Organization verification" subtitle="Check each application against the documents provided. Approved organizations get a verified badge and can run emergency campaigns." />
      <Async state={pending} empty={<EmptyState icon="shield" title="No applications waiting" text="New verification requests will appear here." />}>
        {(apps) => (
          <ul className="space-y-4">
            {apps.map((a) => {
              const o = a.organization;
              const d = o?.organizationDetails || {};
              return (
                <li key={a._id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-sans text-lg font-semibold">{d.orgName || o?.name}</h2>
                      <p className="text-sm text-stone-600">{ORG_TYPES[d.orgType] || 'Organization'} · {o?.email}{o?.phone ? ` · ${o.phone}` : ''}</p>
                      <p className="mt-0.5 text-xs text-stone-500">Applied {timeAgo(a.createdAt)} · account created {fmtDate(o?.createdAt)}</p>
                    </div>
                    <Badge cls="bg-amber-100 text-amber-800 ring-amber-200">Pending review</Badge>
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Registration number</dt><dd>{d.registrationNumber || '—'}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Website</dt><dd>{d.website ? <a className="link" href={d.website} target="_blank" rel="noopener noreferrer">{d.website}</a> : '—'}</dd></div>
                    <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">About</dt><dd className="whitespace-pre-line">{d.description || '—'}</dd></div>
                    {a.message && <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Message to the reviewer</dt><dd className="whitespace-pre-line">{a.message}</dd></div>}
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Supporting documents</dt>
                      <dd>
                        {a.documents?.length ? (
                          <ul className="mt-1 flex flex-wrap gap-2">
                            {a.documents.map((doc, i) => (
                              <li key={i}><a className="btn btn-secondary btn-sm" href={imgSrc(doc.url)} target="_blank" rel="noopener noreferrer"><Icon name="list" className="h-4 w-4" />{doc.name || `Document ${i + 1}`}</a></li>
                            ))}
                          </ul>
                        ) : <span className="text-stone-500">None attached</span>}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-stone-100 pt-4">
                    <button type="button" className="btn btn-secondary" onClick={() => setDecision({ app: a, decision: 'REJECTED' })}>Decline</button>
                    <button type="button" className="btn btn-primary" onClick={() => setDecision({ app: a, decision: 'APPROVED' })}><Icon name="check" className="h-4 w-4" />Approve</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Async>

      <NoteDialog
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision?.decision === 'APPROVED' ? 'Verify this organization?' : 'Decline this application?'}
        label={decision?.decision === 'APPROVED' ? 'Note (optional)' : 'Reason (shown to the organization)'}
        required={decision?.decision === 'REJECTED'}
        danger={decision?.decision === 'REJECTED'}
        confirmLabel={decision?.decision === 'APPROVED' ? 'Verify' : 'Decline'}
        onSubmit={decide}
      />
    </div>
  );
}
