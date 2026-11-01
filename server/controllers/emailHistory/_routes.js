const guarded = require('../../middelwares/legacyScope');
const Model = require('../../model/schema/email');
const { loadUser, permit } = require('../../middelwares/permissions');
const dynamicValues = require('../../middelwares/dynamicValues')("Emails");
const express = require('express');
const auth = require('../../middelwares/auth');
const email = require('./email')

const router = express.Router();
const activity = require('../../middelwares/activityNotifications')('Emails');

router.get('/', auth, loadUser, guarded.list, email.index)
router.get('/view/:id', auth, loadUser, guarded.record(Model), email.view)
router.post('/add', auth, loadUser, dynamicValues, activity('record_created', email.add))

router.delete('/delete/:id', auth, loadUser, permit('Emails', 'delete'), guarded.record(Model), activity('record_deleted', email.deleteData))
router.post('/deleteMany', auth, loadUser, permit('Emails', 'delete'), guarded.batch(Model), activity('record_deleted', email.deleteMany))

module.exports = router