const express = require('express');
const auth = require('../../middelwares/auth');
const { loadUser } = require('../../middelwares/permissions');
const notification = require('./notification');

const router = express.Router();

router.get('/', auth, loadUser, notification.index);
router.put('/read-all', auth, loadUser, notification.markAllRead);
router.put('/:id/read', auth, loadUser, notification.markRead);

module.exports = router;
