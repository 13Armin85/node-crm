const { loadUser, permit } = require('../../middelwares/permissions');
const guarded = require('../../middelwares/legacyScope');
const { Lead } = require('../../model/schema/lead');
const dynamicValues = require('../../middelwares/dynamicValues')("Leads");
const express = require('express');
const lead = require('./lead');
const auth = require('../../middelwares/auth');

const router = express.Router();

router.get('/', auth, loadUser, permit('Leads', 'view'), guarded.list, lead.index)
router.post('/add', auth, loadUser, dynamicValues, lead.add)
router.post('/addMany', auth, loadUser, permit('Leads', 'create'), guarded.createMany, lead.addMany)
router.get('/view/:id', auth, loadUser, permit('Leads', 'view'), guarded.record(Lead), lead.view)
router.put('/edit/:id', auth, loadUser, dynamicValues, lead.edit)
router.put('/changeStatus/:id', auth, loadUser, permit('Leads', 'update'), guarded.record(Lead), lead.changeStatus)
router.delete('/delete/:id', auth, loadUser, permit('Leads', 'delete'), guarded.record(Lead), lead.deleteData)
router.post('/deleteMany', auth, loadUser, permit('Leads', 'delete'), guarded.batch(Lead), lead.deleteMany)

module.exports = router
