const guarded = require('../../middelwares/legacyScope');
const Model = require('../../model/schema/opprtunity');
const { loadUser } = require('../../middelwares/permissions');
const dynamicValues = require('../../middelwares/dynamicValues')("Opportunities");
const express = require('express');
const auth = require('../../middelwares/auth');
const opportunities = require('./opportunities')

const router = express.Router();
const activity = require('../../middelwares/activityNotifications')('Opportunities');

router.get('/', auth, loadUser, guarded.list, opportunities.index)
router.get('/view/:id', auth, loadUser, guarded.record(Model), opportunities.view)
router.post('/add', auth, loadUser, dynamicValues, activity('record_created', opportunities.add))
router.post('/addMany', auth, loadUser, guarded.createMany, activity('record_created', opportunities.addMany))
router.put('/edit/:id', auth, loadUser, guarded.record(Model), dynamicValues, activity('record_updated', opportunities.edit))
router.delete('/delete/:id', auth, loadUser, guarded.record(Model), activity('record_deleted', opportunities.deleteData))
router.post('/deleteMany', auth, loadUser, guarded.batch(Model), activity('record_deleted', opportunities.deleteMany))

module.exports = router