const dynamicValues = require('../../middelwares/dynamicValues')('OpportunityProject');
const guarded = require('../../middelwares/legacyScope');
const Model = require('../../model/schema/opportunityproject');
const { loadUser, permit } = require('../../middelwares/permissions');
const express = require('express')
const auth = require('../../middelwares/auth');
const opportunityproject = require('./opportunityproject')

const router = express.Router()
router.get("/", auth, loadUser, guarded.list, opportunityproject.index);
router.post('/addMany', auth, loadUser, permit('OpportunityProject', 'create'), guarded.createMany, opportunityproject.addMany)
router.get('/view/:id', auth, loadUser, guarded.record(Model), opportunityproject.view)
router.post('/add', auth, loadUser, dynamicValues, opportunityproject.add)
router.put('/edit/:id', auth, loadUser, guarded.record(Model), dynamicValues, opportunityproject.edit)
router.delete('/delete/:id', auth, loadUser, permit('OpportunityProject', 'delete'), guarded.record(Model), opportunityproject.deleteData)
router.post('/deleteMany', auth, loadUser, permit('OpportunityProject', 'delete'), guarded.batch(Model), opportunityproject.deleteMany)

module.exports = router