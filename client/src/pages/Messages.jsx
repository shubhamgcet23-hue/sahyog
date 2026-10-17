import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import { Async, Avatar, EmptyState, PageLoader, Spinner, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useFetch } from '../hooks/useFetch';
import { api, errMsg } from '../services/api';
import { cn } from '../utils/constants';
import { fmtDate, fmtTime, timeAgo } from '../utils/format';

const same = (a, b) => String(a) === String(b);

/** Real-time chat. The REST API stores everything; Socket.IO only delivers it instantly. */
export default function Messages() {
  const { id } = useParams();
  const nav = useNavigate();
  const { socket, connected, refreshUnread } = useSocket();
  const convs = useFetch(() => api.get('/conversations'), []);
  const active = (convs.data || []).find((c) => same(c._id, id));

  // Keep the sidebar in sync with new messages for conversations that are not open.
  useEffect(() => {
    if (!socket) return undefined;
    const onIncoming = ({ conversationId, message }) => {
      if (same(conversationId, id)) return;
      convs.setData((list) => {
        if (!list || !list.some((c) => same(c._id, conversationId))) { convs.reload(); return list; }
        return list.map((c) => (same(c._id, conversationId) ? { ...c, lastMessagePreview: message.content.slice(0, 140), lastMessageAt: message.createdAt, unread: c.unread + 1 } : c)).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      });
    };
    socket.on('message:incoming', onIncoming);
    return () => socket.off('message:incoming', onIncoming);
  }, [socket, id, convs]);

  const markListRead = useCallback((cid) => {
    convs.setData((list) => (list ? list.map((c) => (same(c._id, cid) ? { ...c, unread: 0 } : c)) : list));
    refreshUnread();
  }, [convs, refreshUnread]);

  return (
    <div className="container-page py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl">Messages</h1>
        <span className={cn('flex items-center gap-1.5 text-xs', connected ? 'text-emerald-700' : 'text-stone-500')} aria-live="polite">
          <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-emerald-500' : 'bg-stone-400')} />{connected ? 'Live' : 'Reconnecting…'}
        </span>
      </div>
      <div className="card grid h-[75vh] min-h-[28rem] overflow-hidden md:grid-cols-3">
        <aside className={cn('overflow-y-auto border-r border-stone-100 md:block', id ? 'hidden' : 'block')} aria-label="Conversations">
          <Async state={convs} empty={<div className="p-6"><EmptyState icon="message" title="No conversations yet" text="A chat opens automatically when you request an item or someone requests yours." action={<Link to="/discover" className="btn btn-primary">Find something</Link>} /></div>}>
            {(list) => (
              <ul>
                {list.map((c) => (
                  <li key={c._id}>
                    <Link to={`/messages/${c._id}`} className={cn('flex items-center gap-3 border-b border-stone-50 px-4 py-3 transition hover:bg-stone-50', same(c._id, id) && 'bg-brand-50')} aria-current={same(c._id, id) ? 'true' : undefined}>
                      <Avatar user={c.with} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2"><p className="truncate text-sm font-semibold">{c.with?.organizationDetails?.orgName || c.with?.name}</p><span className="shrink-0 text-[11px] text-stone-400">{timeAgo(c.lastMessageAt)}</span></div>
                        <p className="truncate text-xs text-stone-500">{c.request?.resource?.title}</p>
                        <p className={cn('truncate text-xs', c.unread ? 'font-semibold text-stone-900' : 'text-stone-500')}>{c.lastMessagePreview || 'No messages yet — say hello'}</p>
                      </div>
                      {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white" aria-label={`${c.unread} unread`}>{c.unread}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </aside>
        <section className={cn('flex min-h-0 flex-col md:col-span-2 md:flex', id ? 'flex' : 'hidden')}>
          {id ? <Thread key={id} id={id} conv={active} socket={socket} connected={connected} onRead={markListRead} onBack={() => nav('/messages')} /> : (
            <div className="grid flex-1 place-items-center p-8 text-center text-stone-500"><div><Icon name="message" className="mx-auto h-10 w-10 text-stone-300" /><p className="mt-3">Select a conversation to start chatting.</p></div></div>
          )}
        </section>
      </div>
    </div>
  );
}

function Thread({ id, conv, socket, connected, onRead, onBack }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const bottom = useRef(null);
  const lastTyping = useRef(0);
  const otherId = conv?.with?._id;

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/conversations/${id}/messages`, { limit: 100 });
      setMessages(data);
      setError('');
      await api.patch(`/conversations/${id}/read`);
      onRead(id);
    } catch (e) { setError(errMsg(e)); }
  }, [id, onRead]);

  useEffect(() => { load(); }, [load]);

  // Join the private room (the server checks participation) — again after every reconnect, then re-sync history.
  useEffect(() => {
    if (!socket || !connected) return undefined;
    socket.emit('conversation:join', { conversationId: id }, (res) => { if (res && !res.ok) setError(res.error || 'Could not join the conversation'); });
    return () => { socket.emit('conversation:leave', { conversationId: id }); };
  }, [socket, connected, id]);
  const wasConnected = useRef(connected);
  useEffect(() => { if (connected && !wasConnected.current) load(); wasConnected.current = connected; }, [connected, load]);

  useEffect(() => {
    if (!socket) return undefined;
    const onNew = (m) => {
      if (!same(m.conversation, id)) return;
      setMessages((list) => (list && !list.some((x) => same(x._id, m._id)) ? [...list, m] : list));
      if (!same(m.sender, user._id)) socket.emit('message:read', { conversationId: id }, () => onRead(id));
    };
    const onSeen = ({ conversationId, userId }) => {
      if (!same(conversationId, id) || same(userId, user._id)) return;
      setMessages((list) => (list ? list.map((m) => (m.readBy?.some((r) => same(r, userId)) ? m : { ...m, readBy: [...(m.readBy || []), userId] })) : list));
    };
    let timer;
    const onTyping = ({ conversationId, userId, typing: t }) => {
      if (!same(conversationId, id) || same(userId, user._id)) return;
      setTyping(t);
      clearTimeout(timer);
      if (t) timer = setTimeout(() => setTyping(false), 4000);
    };
    socket.on('message:new', onNew);
    socket.on('message:read', onSeen);
    socket.on('typing', onTyping);
    return () => { clearTimeout(timer); socket.off('message:new', onNew); socket.off('message:read', onSeen); socket.off('typing', onTyping); };
  }, [socket, id, user._id, onRead]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages?.length, typing]);

  const send = async (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    const add = (m) => setMessages((list) => (list && !list.some((x) => same(x._id, m._id)) ? [...list, m] : list));
    try {
      if (socket && connected) {
        await new Promise((resolve, reject) => {
          socket.timeout(8000).emit('message:send', { conversationId: id, content }, (err, res) => {
            if (err) reject(new Error('The server did not respond. Please try again.'));
            else if (!res?.ok) reject(new Error(res?.error || 'Message not sent'));
            else { add(res.message); resolve(); }
          });
        });
      } else {
        const { data } = await api.post(`/conversations/${id}/messages`, { content }); // offline-safe fallback
        add(data.message);
      }
      setText('');
    } catch (err) { toast.error(err.response ? errMsg(err) : err.message); } finally { setSending(false); }
  };

  const onType = (v) => {
    setText(v);
    if (socket && connected && Date.now() - lastTyping.current > 2000) { lastTyping.current = Date.now(); socket.emit('typing', { conversationId: id, typing: true }); }
  };

  if (error && !messages) return <div className="grid flex-1 place-items-center p-6 text-center"><div><p className="text-red-700" role="alert">{error}</p><button type="button" className="btn btn-secondary mt-3" onClick={load}>Retry</button></div></div>;
  if (!messages) return <PageLoader label="Loading conversation…" />;

  let lastDay = '';
  return (
    <>
      <header className="flex items-center gap-3 border-b border-stone-100 px-4 py-3">
        <button type="button" className="rounded-lg p-1.5 hover:bg-stone-100 md:hidden" onClick={onBack} aria-label="Back to conversations"><Icon name="arrow" className="h-5 w-5 rotate-180" /></button>
        <Avatar user={conv?.with} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{conv?.with ? <Link to={`/users/${otherId}`} className="hover:underline">{conv.with.organizationDetails?.orgName || conv.with.name}</Link> : 'Conversation'}</p>
          {conv?.request && <p className="truncate text-xs text-stone-500"><Link to={`/requests/${conv.request._id}`} className="hover:underline">{conv.request.resource?.title}</Link> · <StatusBadge status={conv.request.status} /></p>}
        </div>
      </header>

      <div className="flex-1 space-y-1 overflow-y-auto bg-stone-50/60 px-4 py-4" role="log" aria-live="polite" aria-label="Messages">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-stone-500">No messages yet. Say hello and agree on a time and public place to meet.</p>}
        {messages.map((m) => {
          const mine = same(m.sender, user._id);
          const day = fmtDate(m.createdAt);
          const showDay = day !== lastDay; lastDay = day;
          const seen = mine && otherId && m.readBy?.some((r) => same(r, otherId));
          return (
            <div key={m._id}>
              {showDay && <p className="my-3 text-center text-[11px] font-semibold uppercase tracking-wider text-stone-400">{day}</p>}
              <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm', mine ? 'rounded-br-md bg-brand-700 text-white' : 'rounded-bl-md bg-white text-stone-800')}>
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={cn('mt-0.5 text-right text-[10px]', mine ? 'text-brand-200' : 'text-stone-400')}>{fmtTime(m.createdAt)}{mine && <span className="ml-1">{seen ? '✓✓ Seen' : '✓ Sent'}</span>}</p>
                </div>
              </div>
            </div>
          );
        })}
        {typing && <p className="text-xs italic text-stone-500">{conv?.with?.name || 'They'} is typing…</p>}
        <div ref={bottom} />
      </div>

      {conv?.request && ['REJECTED', 'CANCELLED'].includes(conv.request.status) ? (
        <p className="border-t border-stone-100 p-4 text-center text-sm text-stone-500">This conversation is closed because the request was {conv.request.status.toLowerCase()}.</p>
      ) : (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-stone-100 p-3">
          <label htmlFor="msg" className="sr-only">Write a message</label>
          <textarea id="msg" rows={1} className="input max-h-32 min-h-[2.75rem] resize-none" placeholder="Write a message…" maxLength={2000} value={text} onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e); }} />
          <button type="submit" className="btn btn-primary h-11" disabled={!text.trim() || sending} aria-label="Send message">{sending ? <Spinner className="h-4 w-4 text-white" /> : <Icon name="send" className="h-4 w-4" />}</button>
        </form>
      )}
      <p className="sr-only" aria-live="polite">{connected ? 'Connected' : 'Offline — messages are sent over the regular connection'}</p>
      {!connected && <p className="border-t border-amber-100 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800">Reconnecting… your messages will still be sent.</p>}
    </>
  );
}
