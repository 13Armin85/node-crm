const express = require('express');
const document = require('./document');
const auth = require('../../middelwares/auth');
const { loadUser } = require('../../middelwares/permissions');
const dynamicValues = require('../../middelwares/dynamicValues')('Documents');

const router = express.Router();

router.get('/', auth, document.index)
router.post('/add', auth, loadUser, document.upload.array('files'), dynamicValues, document.file)
router.post('/addDocumentContact', auth, document.upload.array('files'), document.addDocumentContact)
router.post('/addDocumentLead', auth, document.upload.array('files'), document.addDocumentLead)

router.get('/download/:id', document.downloadFile)
router.post('/link-document/:id', document.LinkDocument)
router.delete('/delete/:id', document.deleteFile)
router.use('/images', express.static('uploads/document'));


module.exports = router
