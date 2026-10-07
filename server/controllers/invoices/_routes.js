const guarded = require('../../middelwares/legacyScope');
const Model = require('../../model/schema/invoices');
const { loadUser } = require('../../middelwares/permissions');
const dynamicValues = require('../../middelwares/dynamicValues')("Invoices");
const express = require('express');
const invoices = require('./invoices');
const auth = require('../../middelwares/auth');

const router = express.Router();
const activity = require('../../middelwares/activityNotifications')('Invoices');

router.get('/', auth, loadUser, guarded.list, invoices.index)
router.post('/add', auth, loadUser, dynamicValues, activity('record_created', invoices.add))
router.post('/addMany', auth, loadUser, guarded.createMany, activity('record_created', invoices.addMany))
router.get('/view/:id', auth, loadUser, guarded.record(Model), invoices.view)
router.put('/edit/:id', auth, loadUser, guarded.record(Model), dynamicValues, activity('record_updated', invoices.edit))
router.delete('/delete/:id', auth, loadUser, guarded.record(Model), activity('record_deleted', invoices.deleteData))
router.post('/deleteMany', auth, loadUser, guarded.batch(Model), activity('record_deleted', invoices.deleteMany))

module.exports = router