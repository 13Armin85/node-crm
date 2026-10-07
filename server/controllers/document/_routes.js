const express = require('express');
const document = require('./document');
const auth = require('../../middelwares/auth');
const { loadUser } = require('../../middelwares/permissions');
const dynamicValues = require('../../middelwares/dynamicValues')('Documents');

const router = express.Router();
const activity = require('../../middelwares/activityNotifications')('Documents');

router.get('/', auth, document.index)
router.post('/folder', auth, activity('record_created', document.createFolder, { createdStatus: 201 }))
router.post('/add', auth, loadUser, document.upload.array('files'), document.validateUploads, dynamicValues, activity('document_uploaded', document.file))
router.post('/addDocumentContact', auth, document.upload.array('files'), document.validateUploads, activity('document_uploaded', document.addDocumentContact))
router.post('/addDocumentLead', auth, document.upload.array('files'), document.validateUploads, activity('document_uploaded', document.addDocumentLead))

router.get('/download/:id', auth, document.downloadFile)
router.post('/link-document/:id', auth, activity('document_linked', document.LinkDocument, { embeddedFile: true }))
router.delete('/delete/:id', auth, activity('record_deleted', document.deleteFile, { embeddedFile: true }))
router.get('/images/:filename', auth, document.previewFile);


module.exports = router
