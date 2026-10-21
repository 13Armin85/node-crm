import { useEffect, useRef } from 'react';
export default function useRecordRefresh(refresh) {
  const callback = useRef(refresh);
  callback.current = refresh;
  useEffect(() => {
    let inFlight = false, active = true;
    const update = async () => {
      if (!active || inFlight || document.visibilityState === 'hidden' || document.body.classList.contains('crm-kanban-is-dragging')) return;
      inFlight = true;
      try { await callback.current(); } finally { inFlight = false; }
    };
    const interval = window.setInterval(update, 10000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => { active = false; clearInterval(interval); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, []);
}
