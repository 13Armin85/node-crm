const { loadUser } = require('../../middelwares/permissions');
const dynamicValues = require('../../middelwares/dynamicValues')("Calls");
const express = require('express');
const auth = require('../../middelwares/auth');
const phoneCall = require('./phonCall')

const router = express.Router();

router.get('/', auth, phoneCall.index)
router.get('/view/:id', auth, phoneCall.view)
router.post('/add', auth, loadUser, dynamicValues, phoneCall.add)

module.exports = router