const express = require('express');
const moduleActiveDeactive = require('./moduleActiveDeactive');
const auth = require('../../middelwares/auth');

const router = express.Router();
const { loadUser, adminOnly } = require('../../middelwares/permissions');
router.use(auth, loadUser, (req, res, next) => req.method === 'GET' ? next() : adminOnly(req, res, next));

router.get('/', auth, moduleActiveDeactive.index)
router.put('/edit', auth, moduleActiveDeactive.Edit)

module.exports = router