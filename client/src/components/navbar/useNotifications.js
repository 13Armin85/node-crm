import { useCallback, useEffect, useRef, useState } from 'react';
import { getApi, putApi } from 'services/api';
import { AUTH_CHANGED_EVENT, getStoredToken } from 'services/authSession';
import { NOTIFICATIONS_CHANGED_EVENT } from 'services/notificationEvents';

const merge = (incoming, current) => [...new Map([...current, ...incoming].map(item => [item._id, item])).values()]
  .sort((a, b) => b._id.localeCompare(a._id));

export default function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const session = useRef(null);
  const sequence = useRef(0);
  const mounted = useRef(false);
  const cursor = useRef(null);
  const historyLoaded = useRef(false);
  const busy = useRef(false);
  const fetching = useRef(false);

  const reset = useCallback(() => {
    sequence.current += 1;
    session.current = getStoredToken();
    cursor.current = null;
    historyLoaded.current = false;
    busy.current = false;
    fetching.current = false;
    setNotifications([]);
    setUnreadCount(0);
    setHasMore(false);
    setLoading(Boolean(session.current));
    setLoadingMore(false);
    setUpdating(false);
    setError('');
  }, []);

  const load = useCallback(async (append = false) => {
    const token = getStoredToken();
    if (session.current !== token) reset();
    if (!token || !mounted.current || busy.current || fetching.current) return;
    if (append && !cursor.current) return;
    const requestId = ++sequence.current;
    fetching.current = true;
    if (append) setLoadingMore(true);
    const valid = () => mounted.current && requestId === sequence.current && token === getStoredToken();
    try {
      const result = await getApi('api/notification' + (append ? '?before=' + encodeURIComponent(cursor.current) : ''));
      if (!valid()) return;
      if (result?.status !== 200 || !Array.isArray(result.data?.notifications)) throw new Error('Failed to load notifications');
      const rows = result.data.notifications;
      setNotifications(current => append || historyLoaded.current ? merge(rows, current) : rows);
      setUnreadCount(Number(result.data.unreadCount) || 0);
      if (append || !historyLoaded.current) {
        setHasMore(Boolean(result.data.hasMore));
        cursor.current = result.data.nextCursor;
      }
      if (append) historyLoaded.current = true;
      setError('');
    } catch (failure) {
      if (valid()) setError('Failed to load notifications');
    } finally {
      if (valid()) {
        fetching.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [reset]);

  useEffect(() => {
    mounted.current = true;
    reset();
    const refresh = () => { if (!document.hidden) load(); };
    const authChanged = () => { reset(); load(); };
    load();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    window.addEventListener(AUTH_CHANGED_EVENT, authChanged);
    window.addEventListener('storage', authChanged);
    return () => {
      mounted.current = false;
      sequence.current += 1;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
      window.removeEventListener(AUTH_CHANGED_EVENT, authChanged);
      window.removeEventListener('storage', authChanged);
    };
  }, [load, reset, userId]);

  const read = useCallback(async (notification) => {
    if (busy.current) return false;
    if (notification?.readAt) return true;
    const token = getStoredToken();
    if (!token) return false;
    const requestId = ++sequence.current;
    busy.current = true;
    fetching.current = false;
    setLoadingMore(false);
    setUpdating(true);
    const valid = () => mounted.current && requestId === sequence.current && token === getStoredToken();
    try {
      const result = await putApi(notification ? 'api/notification/' + notification._id + '/read' : 'api/notification/read-all', {});
      if (!valid()) return false;
      if (result?.status !== 200) throw new Error('Failed to update notifications');
      const readAt = result.data?.readAt || new Date().toISOString();
      setNotifications(current => current.map(item => (
        (notification ? item._id === notification._id : new Date(item.createdAt).getTime() <= new Date(readAt).getTime())
          ? { ...item, readAt: item.readAt || readAt } : item
      )));
      if (!notification && Number.isFinite(result.data?.unreadCount)) setUnreadCount(result.data.unreadCount);
      setError('');
      return true;
    } catch (failure) {
      if (valid()) setError('Failed to update notifications');
      return false;
    } finally {
      if (valid()) {
        busy.current = false;
        setUpdating(false);
        await load();
      }
    }
  }, [load]);

  return { notifications, unreadCount, hasMore, loading, loadingMore, updating, error,
    refresh: () => load(), loadMore: () => load(true), markRead: read, markAllRead: () => read(null) };
}
