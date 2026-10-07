const guarded = require('../../middelwares/legacyScope');
const Model = require('../../model/schema/meeting');
const { loadUser } = require('../../middelwares/permissions');
const dynamicValues = require('../../middelwares/dynamicValues')("Meetings");
const express = require('express');
const auth = require('../../middelwares/auth');
const meeting = require('./meeting')

const router = express.Router();
const activity = require('../../middelwares/activityNotifications')('Meetings');

router.get('/', auth, loadUser, guarded.list, meeting.index)
router.get('/view/:id', auth, loadUser, guarded.record(Model), meeting.view)
router.post('/add', auth, loadUser, dynamicValues, activity('record_created', meeting.add))
router.delete('/delete/:id', auth, loadUser, guarded.record(Model), activity('record_deleted', meeting.deleteData))
router.post('/deleteMany', auth, loadUser, guarded.batch(Model), activity('record_deleted', meeting.deleteMany))

module.exports = router