const dynamicValues = require('../../middelwares/dynamicValues')('Quotes');
const guarded = require('../../middelwares/legacyScope');
const Model = require('../../model/schema/quotes');
const express = require('express');
const quotes = require('./quotes');
const auth = require('../../middelwares/auth');
const { loadUser, permit } = require('../../middelwares/permissions');

const router = express.Router();
const activity = require('../../middelwares/activityNotifications')('Quotes');

router.get('/', auth, loadUser, guarded.list, quotes.index)
router.post('/add', auth, loadUser, dynamicValues, activity('record_created', quotes.add))
router.post('/addMany', auth, loadUser, permit('Quotes', 'create'), guarded.createMany, activity('record_created', quotes.addMany))
router.get('/view/:id', auth, loadUser, guarded.record(Model), quotes.view)
router.put('/edit/:id', auth, loadUser, guarded.record(Model), dynamicValues, activity('record_updated', quotes.edit))
router.post('/convertToInvoice', auth, loadUser, permit('Quotes', 'update'), activity('record_updated', quotes.convertToInvoice))
router.delete('/delete/:id', auth, loadUser, permit('Quotes', 'delete'), guarded.record(Model), activity('record_deleted', quotes.deleteData))
router.post('/deleteMany', auth, loadUser, permit('Quotes', 'delete'), guarded.batch(Model), activity('record_deleted', quotes.deleteMany))

module.exports = router