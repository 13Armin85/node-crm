import DOMPurify from 'dompurify';

export const sanitizeHtml = html => DOMPurify.sanitize(typeof html === 'string' ? html : '', {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed', 'meta', 'link', 'base'],
  FORBID_ATTR: ['style', 'srcset'],
  SANITIZE_NAMED_PROPS: true,
});
export const safeUrl = value => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
};
export const openSafeUrl = value => {
  const url = safeUrl(value);
  if (url) return window.open(url, '_blank', 'noopener,noreferrer');
};

export const safeInternalPath = (value, fallback = '/default') => {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (/^\/\//.test(decoded) || /[\\\u0000-\u001f]/.test(decoded)) return fallback;
    return new URL(value, window.location.origin).origin === window.location.origin ? value : fallback;
  } catch { return fallback; }
};
