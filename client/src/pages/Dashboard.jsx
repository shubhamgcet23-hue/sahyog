import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { Async, Avatar, Badge, EmptyState, PageHeader, StatCard, TrustBadge, VerifiedBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import { fmtDate, fmtNumber, orgName, timeAgo } from '../utils/format';

const TRUST_LABELS = { base: 'Starting score', exchanges: 'Completed exchanges', fulfilment: 'Reliability (owner)', rating: 'Average rating', verifiedOrganization: 'Verified organization', violationPenalty: 'Confirmed violations' };

function Panel({ title, action, children, className = '' }) {
  return (
    <section className={`card p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-sans text-base font-semibold text-stone-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function VerificationBanner({ details }) {
  const s = details?.verificationStatus || 'NONE';
  if (s === 'VERIFIED') return null;
  const text = {
    NONE: 'Verify your organization to post emergency campaigns and show a verified badge.',
    PENDING: 'Your verification application is being reviewed by an administrator.',
    REJECTED: 'Your last application was not approved. Review the note and apply again.',
  }[s];
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-saffron-200 bg-saffron-50 p-4 text-sm text-saffron-700" role="status">
      <span className="flex items-center gap-2"><Icon name="shield" className="h-5 w-5" />{text}</span>
      <Link to="/organization" className="btn btn-accent btn-sm">{s === 'PENDING' ? 'View status' : 'Verification'}</Link>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const act = useFetch(() => api.get('/users/me/activity'), []);
  const notes = useFetch(() => api.get('/notifications', { limit: 5 }), []);
  const pending = useFetch(() => api.get('/users/me/pending-reviews'), []);
  const isOrg = user.role === 'ORGANIZATION';

  return (
    <div className="container-page py-8">
      <PageHeader
        eyebrow={isOrg ? 'Organization dashboard' : 'Your dashboard'}
        title={`Namaste, ${isOrg ? orgName(user) : user.name.split(' ')[0]}`}
        subtitle="Here’s what’s happening with your listings, requests and community activity."
        actions={<><Link to="/resources/new" className="btn btn-accent"><Icon name="plus" className="h-4 w-4" />Share a resource</Link><Link to="/emergencies/new" className="btn btn-secondary"><Icon name="alert" className="h-4 w-4" />Ask for help</Link></>}
      />
      {isOrg && <VerificationBanner details={user.organizationDetails} />}

      <Async state={act}>
        {(d) => (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard icon="box" label="Active listings" value={d.stats.activeListings} />
              <StatCard icon="repeat" tone="saffron" label="Pending approvals" value={d.stats.pendingApprovals} hint={`${d.stats.incomingRequests} incoming in total`} />
              <StatCard icon="send" tone="sky" label="My open requests" value={d.stats.outgoingRequests} />
              <StatCard icon="check" label="Completed exchanges" value={d.stats.completedExchanges} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                {d.stats.pendingApprovals > 0 && (
                  <Link to="/requests?tab=received&status=PENDING" className="flex items-center justify-between rounded-2xl bg-brand-700 p-4 text-white transition hover:bg-brand-800">
                    <span className="flex items-center gap-3"><Icon name="bell" /><span><strong>{d.stats.pendingApprovals} request{d.stats.pendingApprovals > 1 ? 's' : ''}</strong> waiting for your decision</span></span>
                    <Icon name="arrow" />
                  </Link>
                )}

                <Panel title="Items I’m borrowing" action={<Link to="/requests" className="link text-sm">All requests</Link>}>
                  {d.borrowed.length === 0 ? <p className="text-sm text-stone-500">Nothing borrowed right now.</p> : (
                    <ul className="divide-y divide-stone-100">
                      {d.borrowed.map((b) => (
                        <li key={b._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                          <Link to={`/requests/${b._id}`} className="min-w-0 font-medium hover:underline">{b.resource?.title || 'Item'}</Link>
                          <span className="flex items-center gap-2 text-sm">
                            {b.isOverdue ? <Badge cls="bg-red-600 text-white ring-red-700"><Icon name="clock" className="h-3 w-3" />Overdue</Badge> : <Badge>{b.status === 'IN_PROGRESS' ? 'In use' : 'Approved'}</Badge>}
                            <span className="text-stone-600">Return by {fmtDate(b.proposedReturnDate)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title="Donation history">
                  {d.donationHistory.length === 0 ? <p className="text-sm text-stone-500">Completed donations you gave or received will appear here.</p> : (
                    <ul className="divide-y divide-stone-100">
                      {d.donationHistory.map((x) => (
                        <li key={x._id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                          <span className="min-w-0 truncate font-medium">{x.resource?.title || 'Item'} × {x.quantity}</span>
                          <span className="flex items-center gap-2 text-stone-600"><Badge cls={x.direction === 'GIVEN' ? 'bg-saffron-100 text-saffron-700 ring-saffron-200' : 'bg-sky-100 text-sky-800 ring-sky-200'}>{x.direction === 'GIVEN' ? 'Given' : 'Received'}</Badge>{fmtDate(x.completedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                {(pending.data || []).length > 0 && (
                  <Panel title="Leave a review" className="border-saffron-200 bg-saffron-50">
                    <ul className="space-y-1.5 text-sm">
                      {pending.data.slice(0, 5).map((p) => <li key={p._id}><Link className="link" to={`/requests/${p._id}`}>How did “{p.resource?.title}” go? Rate the exchange →</Link></li>)}
                    </ul>
                  </Panel>
                )}

                {isOrg && d.organization && (
                  <Panel title="Organization impact">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      <StatCard icon="box" label="Units in inventory" value={fmtNumber(d.organization.inventory.unitsAvailable)} hint={`${d.organization.inventory.listings} listings`} />
                      <StatCard icon="gift" tone="saffron" label="Donations received" value={d.organization.donationsReceived.count} hint={`${fmtNumber(d.organization.donationsReceived.units)} units`} />
                      <StatCard icon="users" label="Resources distributed" value={d.organization.resourcesDistributed.count} hint={`${fmtNumber(d.organization.resourcesDistributed.units)} units`} />
                      <StatCard icon="alert" tone="red" label="Emergency responses" value={d.organization.emergencyResponses} />
                      <StatCard icon="flag" tone="sky" label="Campaigns created" value={d.organization.campaignsCreated} />
                    </div>
                  </Panel>
                )}
              </div>

              <div className="space-y-6">
                <Panel title="Trust & rewards">
                  <div className="flex items-center justify-between">
                    <div><p className="text-3xl font-bold text-brand-900">{d.trustScore}</p><p className="text-xs text-stone-500">Trust score (0–100)</p></div>
                    <div className="text-right"><p className="text-3xl font-bold text-saffron-600">{fmtNumber(d.rewardPoints)}</p><p className="text-xs text-stone-500">Reward points</p></div>
                  </div>
                  {d.trustBreakdown && (
                    <dl className="mt-4 space-y-1 border-t border-stone-100 pt-3 text-xs">
                      {Object.entries(d.trustBreakdown).map(([k, v]) => (
                        <div key={k} className="flex justify-between"><dt className="text-stone-600">{TRUST_LABELS[k] || k}</dt><dd className={v < 0 ? 'font-semibold text-red-700' : 'font-semibold'}>{v > 0 && k !== 'base' ? '+' : ''}{v}</dd></div>
                      ))}
                    </dl>
                  )}
                  <p className="mt-3 text-xs text-stone-500">Trust is calculated automatically from real activity — it can’t be edited. Points are a thank-you, not money.</p>
                  {d.rewardLedger.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-xs">
                      {d.rewardLedger.slice(0, 5).map((t) => <li key={t._id} className="flex justify-between gap-2"><span className="truncate text-stone-600">{t.description}</span><span className={t.points < 0 ? 'font-semibold text-red-700' : 'font-semibold text-emerald-700'}>{t.points > 0 ? '+' : ''}{t.points}</span></li>)}
                    </ul>
                  )}
                </Panel>

                <Panel title="Recent conversations" action={<Link to="/messages" className="link text-sm">Open</Link>}>
                  {d.recentConversations.length === 0 ? <p className="text-sm text-stone-500">Chats start when you make or receive a request.</p> : (
                    <ul className="space-y-3">
                      {d.recentConversations.map((c) => (
                        <li key={c._id}>
                          <Link to={`/messages/${c._id}`} className="flex items-center gap-3 rounded-xl p-1 hover:bg-stone-50">
                            <Avatar user={c.with} />
                            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{c.with?.name}</p><p className="truncate text-xs text-stone-500">{c.lastMessagePreview || 'No messages yet'}</p></div>
                            {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{c.unread}</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title="Notifications" action={<Link to="/notifications" className="link text-sm">See all</Link>}>
                  <Async state={notes} empty={<p className="text-sm text-stone-500">You’re all caught up.</p>}>
                    {(items) => <ul className="space-y-2.5">{items.map((n) => <li key={n._id} className="text-sm"><Link to={n.link || '/notifications'} className={n.isRead ? 'text-stone-600' : 'font-semibold text-stone-900'}>{n.title}</Link><span className="block text-xs text-stone-400">{timeAgo(n.createdAt)}</span></li>)}</ul>}
                  </Async>
                </Panel>

                <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
                  <TrustBadge score={d.trustScore} />{isOrg && user.organizationDetails?.verificationStatus === 'VERIFIED' && <VerifiedBadge />}
                  <Link to="/profile" className="link ml-auto">Edit profile</Link>
                </div>
              </div>
            </div>
            {d.stats.activeListings === 0 && d.stats.completedExchanges === 0 && (
              <div className="mt-8"><EmptyState icon="gift" title="Start your Sahyog journey" text="List something you can spare or find something nearby — your first exchange earns your first reward points." action={<Link to="/discover" className="btn btn-primary">Discover resources</Link>} /></div>
            )}
          </>
        )}
      </Async>
    </div>
  );
}
