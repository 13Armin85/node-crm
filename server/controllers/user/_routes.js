const express = require('express');
const user = require('./user');
const auth = require('../../middelwares/auth');
const { loadUser, permit, adminOnly } = require('../../middelwares/permissions');
const dynamicValues = require('../../middelwares/dynamicValues')('Users');

const router = express.Router();

router.get('/', auth, loadUser, permit('Users', 'view'), user.index)
router.post('/register', auth, loadUser, adminOnly, dynamicValues, user.register)
router.post('/login', user.login)
router.post('/deleteMany', auth, loadUser, permit('Users', 'delete'), user.deleteMany)
router.get('/view/:id', auth, loadUser, user.view)
router.delete('/delete/:id', auth, loadUser, permit('Users', 'delete'), user.deleteData)
router.put('/edit/:id', auth, loadUser, dynamicValues, user.edit)



module.exports = router
