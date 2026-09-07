const express = require('express');
const form = require('./form');
const auth = require('../../middelwares/auth');
const { loadUser } = require('../../middelwares/permissions');
const guard = require('../../middelwares/formGuard');

const router = express.Router();

router.get('/', auth, loadUser, guard, form.index);
router.get('/view/:id', auth, loadUser, guard, form.view);
router.post('/add', auth, loadUser, guard, form.add);
router.put('/edit/:id', auth, loadUser, guard, form.edit);
router.delete('/delete/:id', auth, loadUser, guard, form.deleteField);
router.post('/deleteMany', auth, loadUser, guard, form.deleteManyField);

module.exports = router
