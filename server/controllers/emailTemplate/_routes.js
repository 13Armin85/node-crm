const express = require('express');
const emailTemp = require('./emailTemplate');
const auth = require('../../middelwares/auth');
const { loadUser } = require('../../middelwares/permissions');
const dynamicValues = require('../../middelwares/dynamicValues')('Email Template');

const router = express.Router();

router.get('/', auth, emailTemp.index)
router.post('/add', auth, loadUser, dynamicValues, emailTemp.add)
router.get('/view/:id', auth, emailTemp.view)
router.put('/edit/:id', auth, loadUser, dynamicValues, emailTemp.edit)
router.delete('/delete/:id', auth, emailTemp.deleteData)
router.post('/deleteMany', auth, emailTemp.deleteMany)

module.exports = router
