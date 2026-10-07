const guarded = require('../../middelwares/legacyScope');
const Model = require('../../model/schema/textMsg');
const { loadUser } = require('../../middelwares/permissions');
const express = require('express');
const auth = require('../../middelwares/auth');
const textMsg = require('./textMsg')

const router = express.Router();

router.get('/', auth, loadUser, guarded.list, textMsg.index)
router.get('/view/:id', auth, loadUser, guarded.record(Model), textMsg.view)
router.post('/add', auth, loadUser, require('../../middelwares/dynamicValues')('Texts'), textMsg.add)

module.exports = router