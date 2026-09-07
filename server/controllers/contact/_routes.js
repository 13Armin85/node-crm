const { loadUser, permit } = require('../../middelwares/permissions');
const guarded = require('../../middelwares/legacyScope');
const { Contact } = require('../../model/schema/contact');
const dynamicValues = require('../../middelwares/dynamicValues')("Contacts");
const express = require('express');
const contact = require('./contact');
const auth = require('../../middelwares/auth');

const router = express.Router();

router.get('/', auth, loadUser, permit('Contacts', 'view'), guarded.list, contact.index)
router.post('/add', auth, loadUser, dynamicValues, contact.add)
router.post('/addMany', auth, loadUser, permit('Contacts', 'create'), guarded.createMany, contact.addMany)
router.post('/add-property-interest/:id', auth, loadUser, permit('Contacts', 'update'), guarded.record(Contact), contact.addPropertyInterest)
router.get('/view/:id', auth, loadUser, permit('Contacts', 'view'), guarded.record(Contact), contact.view)
router.put('/edit/:id', auth, loadUser, dynamicValues, contact.edit)
router.delete('/delete/:id', auth, loadUser, permit('Contacts', 'delete'), guarded.record(Contact), contact.deleteData)
router.post('/deleteMany', auth, loadUser, permit('Contacts', 'delete'), guarded.batch(Contact), contact.deleteMany)


module.exports = router
