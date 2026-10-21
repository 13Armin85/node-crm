import { useEffect } from 'react';

// Mobile keyboards can resize the visual viewport without changing CSS vh.
export default function ModalViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    const names = ['--crm-dialog-height', '--crm-dialog-width', '--crm-dialog-top', '--crm-dialog-left'];
    const previous = names.map(name => root.style.getPropertyValue(name));
    let frame;
    const update = () => {
      const values = [viewport?.height || window.innerHeight, viewport?.width || window.innerWidth, viewport?.offsetTop || 0, viewport?.offsetLeft || 0];
      names.forEach((name, index) => root.style.setProperty(name, `${values[index]}px`));
      frame = undefined;
    };
    const schedule = () => { if (frame === undefined) frame = window.requestAnimationFrame(update); };
    update();
    window.addEventListener('resize', schedule);
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    return () => {
      window.removeEventListener('resize', schedule);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      names.forEach((name, index) => previous[index] ? root.style.setProperty(name, previous[index]) : root.style.removeProperty(name));
    };
  }, []);
  return null;
}
