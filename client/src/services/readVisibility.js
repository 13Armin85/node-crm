export const readVisibilityPath = (path, user) => {
  if (user?.role !== 'user') return path;
  const url = new URL(path, 'http://crm.local/');
  // The server enforces per-user module visibility; lists default to all records.
  if (!url.pathname.startsWith('/api/') || /^\/api\/(?:notification)(?:\/|$)/.test(url.pathname)) return path;
  if (url.searchParams.get('createBy') === user._id) url.searchParams.delete('createBy');
  if (/^\/api\/reporting(?:\/|$)/.test(url.pathname) && url.searchParams.get('_id') === user._id) url.searchParams.delete('_id');
  return url.pathname.replace(/^\//, '') + url.search + url.hash;
};
