import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import ReportDialog from '../components/ReportDialog';
import { ResourceCard } from '../components/Cards';
import { Async, Avatar, Badge, EmptyState, Pagination, StatCard, Stars, TrustBadge, VerifiedBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import { ORG_TYPES } from '../utils/constants';
import { fmtDate, orgName } from '../utils/format';

export default function PublicProfile() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const [page, setPage] = useState(1);
  const [reporting, setReporting] = useState(null);
  const profile = useFetch(() => api.get(`/users/${id}`), [id]);
  const listings = useFetch(() => api.get('/resources', { owner: id, limit: 6 }), [id]);
  const reviews = useFetch(() => api.get(`/users/${id}/reviews`, { page, limit: 5 }), [id, page]);

  return (
    <div className="container-page max-w-5xl py-8">
      <Async state={profile}>
        {({ user: u }) => {
          const isOrg = u.role === 'ORGANIZATION';
          const own = me && String(me._id) === String(u._id);
          return (
            <>
              <section className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
                <Avatar user={u} size="h-24 w-24 text-2xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl">{orgName(u)}</h1>{u.organizationDetails?.verificationStatus === 'VERIFIED' && <VerifiedBadge />}{isOrg && <Badge>{ORG_TYPES[u.organizationDetails?.orgType] || 'Organization'}</Badge>}</div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-stone-600"><span className="flex items-center gap-1"><Icon name="pin" className="h-4 w-4" />{u.areaLabel || 'Location not shared'}</span><span>Member since {fmtDate(u.createdAt)}</span></p>
                  {(u.bio || u.organizationDetails?.description) && <p className="mt-3 max-w-2xl text-stone-700">{u.bio || u.organizationDetails.description}</p>}
                  {u.organizationDetails?.website && <a href={u.organizationDetails.website} target="_blank" rel="noreferrer noopener nofollow" className="link mt-2 inline-block text-sm">{u.organizationDetails.website}</a>}
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <TrustBadge score={u.trustScore} />
                  {own ? <Link to="/profile" className="btn btn-secondary btn-sm">Edit profile</Link> : <button type="button" className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-red-700" onClick={() => setReporting({ type: 'USER', id: u._id, label: 'member' })}><Icon name="flag" className="h-3.5 w-3.5" />Report</button>}
                </div>
              </section>

              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard icon="check" label="Completed exchanges" value={u.completedExchanges || 0} />
                <StatCard icon="box" tone="saffron" label="Active listings" value={u.activeListings} />
                <StatCard icon="star" tone="sky" label="Average rating" value={u.rating.average ?? '—'} hint={`${u.rating.count} review${u.rating.count === 1 ? '' : 's'}`} />
                <StatCard icon="award" label="Trust score" value={u.trustScore} />
              </div>

              <section className="mt-8">
                <h2 className="mb-4 text-2xl">Currently sharing</h2>
                <Async state={listings} empty={<EmptyState icon="box" title="Nothing listed right now" />}>
                  {(items) => <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((r) => <ResourceCard key={r._id} resource={r} />)}</div>}
                </Async>
              </section>

              <section className="mt-10">
                <h2 className="mb-4 text-2xl">Reviews</h2>
                <Async state={reviews} empty={<EmptyState icon="star" title="No reviews yet" text="Reviews appear after completed exchanges." />}>
                  {(items) => (
                    <ul className="space-y-3">
                      {items.map((r) => (
                        <li key={r._id} className="card p-4">
                          <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><Avatar user={r.reviewer} size="h-8 w-8" /><span className="text-sm font-semibold">{r.reviewer?.name}</span></span><Stars value={r.rating} /></div>
                          {r.comment && <p className="mt-2 text-stone-700">{r.comment}</p>}
                          <div className="mt-2 flex items-center justify-between text-xs text-stone-400"><span>{fmtDate(r.createdAt)}</span>
                            {me && String(r.reviewer?._id) !== String(me._id) && <button type="button" className="flex items-center gap-1 hover:text-red-700" onClick={() => setReporting({ type: 'REVIEW', id: r._id, label: 'review' })}><Icon name="flag" className="h-3 w-3" />Report review</button>}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Async>
                <Pagination meta={reviews.meta} onPage={setPage} />
              </section>
              <ReportDialog open={!!reporting} onClose={() => setReporting(null)} targetType={reporting?.type} targetId={reporting?.id} label={reporting?.label} />
            </>
          );
        }}
      </Async>
    </div>
  );
}
