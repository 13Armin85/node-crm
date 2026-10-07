const dynamicValues = require('../../middelwares/dynamicValues')('BankDetails');
const guarded = require('../../middelwares/legacyScope');
const Model = require('../../model/schema/bankDetails');
const { loadUser, permit } = require('../../middelwares/permissions');
const express = require('express');
const bankDetails = require('./bankDetails');
const auth = require('../../middelwares/auth');

const router = express.Router();

router.get('/', auth, loadUser, guarded.list, bankDetails.index)
router.post('/add', auth, loadUser, dynamicValues, bankDetails.add)
router.put('/edit/:id', auth, loadUser, guarded.record(Model), dynamicValues, bankDetails.edit)
router.get('/view/:id', auth, loadUser, guarded.record(Model), bankDetails.view)
router.delete('/delete/:id', auth, loadUser, permit('BankDetails', 'delete'), guarded.record(Model), bankDetails.deleteData)
router.post('/deleteMany', auth, loadUser, permit('BankDetails', 'delete'), guarded.batch(Model), bankDetails.deleteMany)

module.exports = router