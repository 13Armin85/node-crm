// Keep folder tree changes and file writes consistent in the single API process.
let pending = Promise.resolve();
const serialize = handler => (req, res, next) => {
  const result = pending.then(() => handler(req, res));
  pending = result.catch(() => {});
  return result.catch(next);
};
module.exports = { serialize };
