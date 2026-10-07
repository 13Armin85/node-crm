// Express 4 does not forward rejected async route promises to its error handler.
const protectAsyncRoutes = router => {
  const wrap = handler => function (req, res, next) {
    try {
      const result = handler(req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (error) { next(error); }
  };
  for (const layer of router.stack || []) {
    if (layer.route) {
      for (const handler of layer.route.stack) if (handler.handle.length < 4) handler.handle = wrap(handler.handle);
    } else if (layer.handle.stack) protectAsyncRoutes(layer.handle);
    else if (layer.handle.length < 4) layer.handle = wrap(layer.handle);
  }
  return router;
};
module.exports = protectAsyncRoutes;
