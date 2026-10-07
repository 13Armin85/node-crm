const guarded = require('../../middelwares/legacyScope');
const Model = require('../../model/schema/emailTemplate');
const express = require('express');
const emailTemp = require('./emailTemplate');
const auth = require('../../middelwares/auth');
const { loadUser, permit } = require('../../middelwares/permissions');
const dynamicValues = require('../../middelwares/dynamicValues')('Email Template');

const router = express.Router();
const activity = require('../../middelwares/activityNotifications')('Email Template');

router.get('/', auth, loadUser, guarded.list, emailTemp.index)
router.post('/add', auth, loadUser, dynamicValues, activity('record_created', emailTemp.add))
router.get('/view/:id', auth, loadUser, guarded.record(Model), emailTemp.view)
router.put('/edit/:id', auth, loadUser, guarded.record(Model), dynamicValues, activity('record_updated', emailTemp.edit))
router.delete('/delete/:id', auth, loadUser, permit('Email Template', 'delete'), guarded.record(Model), activity('record_deleted', emailTemp.deleteData))
router.post('/deleteMany', auth, loadUser, permit('Email Template', 'delete'), guarded.batch(Model), activity('record_deleted', emailTemp.deleteMany))

module.exports = router
