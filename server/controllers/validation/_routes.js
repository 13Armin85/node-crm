const express = require('express');
const auth = require("../../middelwares/auth");
const validation = require('./validation');

const router = express.Router();
const { loadUser, adminOnly } = require('../../middelwares/permissions');
router.use(auth, loadUser, (req, res, next) => req.method === 'GET' ? next() : adminOnly(req, res, next));

router.get('/', auth, validation.index);
router.post('/add', auth, validation.add);
router.get('/view/:id', auth, validation.view);
router.put('/edit/:id', auth, validation.editWholeValidationsArray);
router.delete('/delete/:id', auth, validation.deleteValidationDocument);
router.post('/deleteMany', auth, validation.deleteManyValidationDocuments);

module.exports = router;