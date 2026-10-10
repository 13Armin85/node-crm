const protectedNames = new Set(['__proto__', 'prototype', 'constructor', 'password', 'passwordHash', 'authVersion', 'roles', 'role']);
const protectedModules = new Set(['User', 'Users', 'Notification', 'Notifications', 'Images', 'EstateFile', 'RecordShare', 'RecordShares', 'AuthSession', 'AuthSessions', 'CustomField', 'FormDefinition']);
module.exports = async (req, res, next) => {
  if (['GET', 'HEAD'].includes(req.method)) return next();
  const body = req.body || {};
  if ((req.path === '/add-module' || req.path.startsWith('/change-module-name/')) && (typeof body.moduleName !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N}_ -]{0,79}$/u.test(body.moduleName) || protectedModules.has(body.moduleName))) return res.status(400).json({ code: 'invalid', field: 'moduleName' });
  if (req.path.startsWith('/change-module-name/')) {
    const moduleId = req.params.id || req.path.split('/').pop();
    if (!require('../services/estateValidation').objectId(moduleId)) return res.status(400).json({ code: 'invalid', field: 'moduleId' });
    const previous = await require('../model/schema/customField').findById(moduleId).select('moduleName').lean();
    if (previous && protectedModules.has(previous.moduleName)) return res.status(400).json({ code: 'systemFieldProtected', field: 'moduleName' });
  }
  const fields = Array.isArray(body) ? [...body] : Array.isArray(body.fields) ? [...body.fields] : body.fields && typeof body.fields === 'object' ? [body.fields] : [];
  if (body.updatedField && typeof body.updatedField === 'object') fields.push(body.updatedField);
  if (fields.length > 200 || fields.some(field => !field || typeof field !== 'object' || Array.isArray(field))) return res.status(400).json({ code: 'invalid', field: 'fields' });
  for (const field of fields) if (typeof field.name === 'string' && (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/.test(field.name) || field.name.split('.').some(part => protectedNames.has(part)))) return res.status(400).json({ code: 'invalid', field: 'name' });
  next();
};
