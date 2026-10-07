const guarded = require('../../middelwares/legacyScope');
const Model = require('../../model/schema/phoneCall');
const { loadUser } = require('../../middelwares/permissions');
const dynamicValues = require('../../middelwares/dynamicValues')("Calls");
const express = require('express');
const auth = require('../../middelwares/auth');
const phoneCall = require('./phonCall')

const router = express.Router();
const activity = require('../../middelwares/activityNotifications')('Calls');

router.get('/', auth, loadUser, guarded.list, phoneCall.index)
router.get('/view/:id', auth, loadUser, guarded.record(Model), phoneCall.view)
router.post('/add', auth, loadUser, dynamicValues, activity('record_created', phoneCall.add))

module.exports = router