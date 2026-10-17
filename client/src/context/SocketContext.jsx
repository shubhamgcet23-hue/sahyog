import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { api, SOCKET_URL } from '../services/api';
import { useAuth } from './AuthContext';

const SocketContext = createContext({ socket: null, connected: false, unread: 0, refreshUnread: () => {}, setUnread: () => {} });

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState(0);
  const userId = user?._id;

  const refreshUnread = useCallback(async () => {
    try {
      const { meta } = await api.get('/notifications', { limit: 1 });
      setUnread(meta?.unread || 0);
    } catch { /* badge simply stays as is */ }
  }, []);

  useEffect(() => {
    if (!userId) {
      setSocket(null); setConnected(false); setUnread(0);
      return undefined;
    }
    refreshUnread();
    // A short-lived token is fetched on every (re)connect, so it works across origins and after network drops.
    const s = io(SOCKET_URL, {
      withCredentials: true,
      reconnectionDelayMax: 8000,
      auth: (cb) => {
        api.get('/auth/socket-token').then((r) => cb({ token: r.data.token })).catch(() => cb({}));
      },
    });
    const onNotification = (n) => {
      setUnread((c) => c + 1);
      toast(n.title, { icon: '🔔' });
    };
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('notification:new', onNotification);
    setSocket(s);
    return () => {
      s.off('notification:new', onNotification);
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [userId, refreshUnread]);

  const value = useMemo(() => ({ socket, connected, unread, setUnread, refreshUnread }), [socket, connected, unread, refreshUnread]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
