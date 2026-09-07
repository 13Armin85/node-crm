const { loadUser } = require('../../middelwares/permissions');
const dynamicValues = require('../../middelwares/dynamicValues')("Opportunities");
const express = require('express');
const auth = require('../../middelwares/auth');
const opportunities = require('./opportunities')

const router = express.Router();

router.get('/', auth, opportunities.index)
router.get('/view/:id', auth, opportunities.view)
router.post('/add', auth, loadUser, dynamicValues, opportunities.add)
router.post('/addMany', auth, opportunities.addMany)
router.put('/edit/:id', auth, loadUser, dynamicValues, opportunities.edit)
router.delete('/delete/:id', auth, opportunities.deleteData)
router.post('/deleteMany', auth, opportunities.deleteMany)

module.exports = router