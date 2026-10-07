const { loadUser, permit } = require('../../middelwares/permissions');
const guarded = require('../../middelwares/legacyScope');
const { Lead } = require('../../model/schema/lead');
const dynamicValues = require('../../middelwares/dynamicValues')("Leads");
const express = require('express');
const lead = require('./lead');
const auth = require('../../middelwares/auth');

const router = express.Router();
const activity = require('../../middelwares/activityNotifications')('Leads');

router.get('/', auth, loadUser, permit('Leads', 'view'), guarded.list, lead.index)
router.post('/add', auth, loadUser, dynamicValues, activity('record_created', lead.add))
router.post('/addMany', auth, loadUser, permit('Leads', 'create'), guarded.createMany, activity('record_created', lead.addMany))
router.get('/view/:id', auth, loadUser, permit('Leads', 'view'), guarded.record(Lead), lead.view)
router.put('/edit/:id', auth, loadUser, guarded.record(Lead), dynamicValues, activity('record_updated', lead.edit))
router.put('/changeStatus/:id', auth, loadUser, permit('Leads', 'update'), guarded.record(Lead), activity('record_status_changed', lead.changeStatus))
router.delete('/delete/:id', auth, loadUser, permit('Leads', 'delete'), guarded.record(Lead), activity('record_deleted', lead.deleteData))
router.post('/deleteMany', auth, loadUser, permit('Leads', 'delete'), guarded.batch(Lead), activity('record_deleted', lead.deleteMany))

module.exports = router
