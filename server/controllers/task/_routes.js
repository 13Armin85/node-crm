const { loadUser, permit } = require('../../middelwares/permissions');
const dynamicValues = require('../../middelwares/dynamicValues')("Tasks");
const express = require('express');
const task = require('./task');
const auth = require('../../middelwares/auth');

const router = express.Router();

router.get('/', auth, task.index)
router.get('/assignees', auth, task.assignees)
router.post('/add', auth, loadUser, permit('Tasks', 'create'), dynamicValues, task.add)
router.get('/view/:id', auth, task.view)
// Ordinary users have read-only task access; administrative roles manage tasks.
router.put('/edit/:id', auth, loadUser, permit('Tasks', 'update'), task.edit)
router.put('/changeStatus/:id', auth, loadUser, permit('Tasks', 'update'), task.changeStatus)
router.delete('/delete/:id', auth, loadUser, permit('Tasks', 'delete'), task.deleteData)
router.post('/deleteMany', auth, loadUser, permit('Tasks', 'delete'), task.deleteMany)

module.exports = router
