const express = require("express");
const auth = require("../../middelwares/auth");
const customField = require("./customField");
const img = require('../../controllers/images/imagesController');

const router = express.Router();
const { loadUser, adminOnly } = require('../../middelwares/permissions');
router.use(auth, loadUser, (req, res, next) => req.method === 'GET' ? next() : adminOnly(req, res, next));

const metadataSecurity = require('../../middelwares/metadataSecurity');
router.use((req, res, next) => req.is('multipart/form-data') ? next() : metadataSecurity(req, res, next));
// module
router.get('/', auth, customField.index);
router.post("/add-module", auth, img.upload.single('icon'), img.validateUploads, metadataSecurity, customField.createNewModule);
router.put("/change-icon/:id", auth, img.upload.single('icon'), img.validateUploads, customField.changeIcon);
router.put("/change-module-name/:id", auth, customField.changeModuleName);
router.delete("/module/:id", auth, customField.deletmodule);
router.post("/deleteMany-Module", auth, customField.deleteManyModule);

router.post('/add', auth, customField.add);
router.get('/view/:id', auth, customField.view);
router.put('/change-fields/:id', auth, customField.editWholeFieldsArray);
router.put('/change-single-field/:id', auth, customField.editSingleField);
router.delete('/delete/:id', auth, customField.deleteField);
router.post('/deleteMany', auth, customField.deleteManyFields);

router.post("/add-heading", auth, customField.addHeading);
router.put('/change-single-heading/:id', auth, customField.editSingleHeading);
router.put('/change-headings/:id', auth, customField.editWholeHeadingsArray);
router.delete('/delete-heading/:id', auth, customField.deleteHeading);
router.post('/deleteMany-headings', auth, customField.deleteManyHeadings);

router.put('/change-belongsTo/:id', auth, customField.changeFieldsBelongsTo);

router.put('/change-table-field/:id', auth, customField.changeIsTableField);
router.put('/change-table-fields', auth, customField.changeIsTableFields);
router.put('/change-view-fields', auth, customField.changeIsViewFields);

router.use("/icon", require('../../services/secureFiles').publicImageHeaders, express.static(require('path').resolve(__dirname, '../../uploads/images'), { dotfiles: 'deny', index: false }));

module.exports = router;
