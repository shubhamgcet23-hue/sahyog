import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import { Async, Button, EmptyState, PageHeader, Pagination, Tabs } from '../components/ui';
import { useSocket } from '../context/SocketContext';
import { useFetch } from '../hooks/useFetch';
import { api, errMsg } from '../services/api';
import { cn } from '../utils/constants';
import { timeAgo } from '../utils/format';

const ICONS = {
  REQUEST_NEW: 'repeat', REQUEST_APPROVED: 'check', REQUEST_REJECTED: 'x', REQUEST_IN_PROGRESS: 'repeat', REQUEST_CANCELLED: 'x', REQUEST_COMPLETED: 'award',
  MESSAGE_NEW: 'message', RETURN_REMINDER: 'clock', RETURN_OVERDUE: 'alert', REVIEW_RECEIVED: 'star', EMERGENCY_RESPONSE: 'heart', EMERGENCY_UPDATE: 'alert',
  ORG_VERIFICATION: 'shield', MODERATION: 'flag', ACCOUNT: 'user', REWARD: 'award',
};

export default function Notifications() {
  const nav = useNavigate();
  const { refreshUnread } = useSocket();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'unread' ? 'unread' : 'all';
  const page = Number(sp.get('page') || 1);
  const state = useFetch(() => api.get('/notifications', { page, limit: 20, unread: tab === 'unread' ? 'true' : undefined }), [tab, page]);

  const open = async (n) => {
    if (!n.isRead) {
      try { await api.patch(`/notifications/${n._id}/read`); state.setData((l) => l.map((x) => (x._id === n._id ? { ...x, isRead: true } : x))); refreshUnread(); } catch { /* navigation still works */ }
    }
    if (n.link) nav(n.link);
  };
  const readAll = async () => {
    try { await api.patch('/notifications/read-all'); toast.success('All caught up'); state.reload(); refreshUnread(); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="container-page max-w-3xl py-8">
      <PageHeader eyebrow="Inbox" title="Notifications" actions={<Button variant="secondary" size="sm" onClick={readAll}><Icon name="check" className="h-4 w-4" />Mark all as read</Button>} />
      <Tabs tabs={[{ key: 'all', label: 'All' }, { key: 'unread', label: 'Unread', count: state.meta?.unread }]} value={tab} onChange={(k) => setSp(k === 'all' ? {} : { tab: k })} label="Notification filter" />
      <Async state={state} empty={<EmptyState icon="bell" title={tab === 'unread' ? 'Nothing unread' : 'No notifications yet'} text="Request updates, messages, reviews and emergency responses will show up here." action={<Link to="/discover" className="btn btn-primary">Discover resources</Link>} />}>
        {(items) => (
          <ul className="card divide-y divide-stone-100 overflow-hidden">
            {items.map((n) => (
              <li key={n._id}>
                <button type="button" onClick={() => open(n)} className={cn('flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-stone-50', !n.isRead && 'bg-brand-50/60')}>
                  <span className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full', n.isRead ? 'bg-stone-100 text-stone-500' : 'bg-brand-100 text-brand-700')}><Icon name={ICONS[n.type] || 'bell'} className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', n.isRead ? 'text-stone-700' : 'font-semibold text-stone-900')}>{n.title}</span>
                    {n.message && <span className="block truncate text-sm text-stone-500">{n.message}</span>}
                    <span className="block text-xs text-stone-400">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.isRead && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Async>
      <Pagination meta={state.meta} onPage={(p) => setSp({ ...(tab === 'unread' ? { tab } : {}), ...(p > 1 ? { page: String(p) } : {}) })} />
    </div>
  );
}
