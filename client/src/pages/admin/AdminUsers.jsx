import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Async, Avatar, Badge, EmptyState, NoteDialog, PageHeader, Pagination, ConfirmDialog, VerifiedBadge } from '../../components/ui';
import { useDebounce, useFetch } from '../../hooks/useFetch';
import { api, errMsg } from '../../services/api';
import { fmtDate, isVerifiedOrg, orgName } from '../../utils/format';

export default function AdminUsers() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const list = useFetch(() => api.get('/admin/users', { q: dq, role, status, page, limit: 15 }), [dq, role, status, page]);
  const [suspend, setSuspend] = useState(null);
  const [reactivate, setReactivate] = useState(null);
  const [busy, setBusy] = useState(false);

  const setUserStatus = async (user, next, reason) => {
    try {
      await api.patch(`/admin/users/${user._id}/status`, { status: next, reason: reason || undefined });
      toast.success(next === 'SUSPENDED' ? `${user.name} was suspended` : `${user.name} was reactivated`);
      list.reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader title="Users & organizations" subtitle="Search members, review their standing and suspend or reactivate accounts when justified. Every action is written to the audit log." />
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]">
        <input className="input" type="search" placeholder="Search by name, email or organization" aria-label="Search users" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className="input" aria-label="Filter by role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All roles</option><option value="USER">Individuals</option><option value="ORGANIZATION">Organizations</option><option value="ADMIN">Administrators</option>
        </select>
        <select className="input" aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Any status</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      <Async state={list} empty={<EmptyState icon="users" title="No members match" text="Try a different search or filter." />}>
        {(items) => (
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Registered members</caption>
              <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                <th scope="col" className="px-4 py-3">Member</th><th scope="col" className="px-4 py-3">Role</th><th scope="col" className="px-4 py-3">Trust</th><th scope="col" className="px-4 py-3">Joined</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u._id} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar user={u} size="h-9 w-9" />
                        <div className="min-w-0">
                          <Link to={`/users/${u._id}`} className="link block truncate">{u.role === 'ORGANIZATION' ? orgName(u) : u.name}</Link>
                          <span className="block truncate text-xs text-stone-500">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="mr-1">{u.role.toLowerCase()}</span>{isVerifiedOrg(u) && <VerifiedBadge />}</td>
                    <td className="px-4 py-3">{Math.round(u.trustScore)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      {u.accountStatus === 'SUSPENDED'
                        ? <Badge cls="bg-red-100 text-red-800 ring-red-200">Suspended</Badge>
                        : <Badge cls="bg-emerald-100 text-emerald-800 ring-emerald-200">Active</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.role === 'ADMIN' ? <span className="text-xs text-stone-400">Protected</span>
                        : u.accountStatus === 'SUSPENDED'
                          ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReactivate(u)}>Reactivate</button>
                          : <button type="button" className="btn btn-danger btn-sm" onClick={() => setSuspend(u)}>Suspend</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Async>
      <Pagination meta={list.meta} onPage={setPage} />

      <NoteDialog
        open={!!suspend}
        onClose={() => setSuspend(null)}
        title={`Suspend ${suspend?.name || ''}?`}
        label="Reason (shown to the member)"
        required
        danger
        confirmLabel="Suspend account"
        onSubmit={async (note) => { await setUserStatus(suspend, 'SUSPENDED', note); setSuspend(null); }}
      />
      <ConfirmDialog
        open={!!reactivate}
        onClose={() => setReactivate(null)}
        title={`Reactivate ${reactivate?.name || ''}?`}
        text="They will be able to sign in and use Sahyog again."
        confirmLabel="Reactivate"
        loading={busy}
        onConfirm={async () => { setBusy(true); await setUserStatus(reactivate, 'ACTIVE'); setBusy(false); setReactivate(null); }}
      />
    </div>
  );
}
