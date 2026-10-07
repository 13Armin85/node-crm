export const readVisibilityPath = (path, user) => {
  if (user?.role !== 'user') return path;
  const url = new URL(path, 'http://crm.local/');
  // Personal modules are scoped by the authenticated actor on the server, including assigned records.
  if (!url.pathname.startsWith('/api/') || /^\/api\/(?:task|notification)(?:\/|$)/.test(url.pathname)) return path;
  if (url.searchParams.get('createBy') === user._id) url.searchParams.delete('createBy');
  if (/^\/api\/reporting(?:\/|$)/.test(url.pathname) && url.searchParams.get('_id') === user._id) url.searchParams.delete('_id');
  return url.pathname.replace(/^\//, '') + url.search + url.hash;
};
