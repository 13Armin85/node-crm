module.exports = (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = data => { if (res.statusCode === 201) res.status(200); return originalJson(data); };
  req.url = `/Properties${req.params.id ? `/${req.params.id}` : ''}`;
  return require('../controllers/estate/_routes')(req, res, next);
};
