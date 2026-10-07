const { readScope } = require('../../services/recordAccess');
const { isAdmin } = require('../../services/userRoles');
const multer = require('multer');
const Document = require('../../model/schema/document');
const User = require('../../model/schema/user');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

const uploadRoot = path.resolve(__dirname, '../../uploads/document');
const { createUpload, validateUploads, withinRoot, fileResponseHeaders } = require('../../services/secureFiles');
const upload = createUpload({ directory: uploadRoot });
const validateUploadedDocuments = validateUploads(uploadRoot);
const validId = require('../../services/estateValidation').objectId;
const categories = new Set(['GENERAL', 'PROPERTIES', 'LEADS', 'OPPORTUNITIES', 'PARTNER_CUSTOMERS', 'CONTACTS', 'INVOICES', 'QUOTES', 'TASKS', 'MEETINGS', 'CALLS', 'EMAILS']);
const categoryForEntity = {
    Property: 'PROPERTIES', Lead: 'LEADS', Opportunity: 'OPPORTUNITIES',
    PartnerCustomer: 'PARTNER_CUSTOMERS', Contact: 'CONTACTS',
};

const actorScope = async (req) => {
    const actor = await User.findOne({ _id: req.user.userId, deleted: false });
    if (!actor) return null;
    return { actor, query: req.method === 'GET' && !req.params?.id && !req.params?.filename ? readScope(req, actor, 'Documents') : isAdmin(actor) ? {} : { createBy: actor._id } };
};

const index = async (req, res) => {
    try {
        const access = await actorScope(req);
        if (!access) return res.status(401).json({ message: 'Authentication failed' });
        const query = { ...access.query, deleted: false };
        if (req.query.parentFolder === 'root') query.parentFolder = null;
        else if (req.query.parentFolder && validId(req.query.parentFolder)) query.parentFolder = req.query.parentFolder;
        const folders = await Document.find(query).populate('createBy', 'firstName lastName username').sort({ folderName: 1 }).lean();
        const entityType = req.query.entityType;
        const entityId = req.query.entityId;
        const category = categories.has(req.query.category) ? req.query.category : null;
        const result = folders.map((folder) => {
            let files = (folder.file || []).filter((item) => !item.deleted).map((item) => {
                if (item.entityType) return item;
                if (item.linkContact) return { ...item, entityType: 'Contact', entityId: item.linkContact };
                if (item.linkLead) return { ...item, entityType: 'Lead', entityId: item.linkLead };
                return item;
            });
            if (entityType) files = files.filter((item) => item.entityType === entityType);
            if (entityId) files = files.filter((item) => String(item.entityId) === String(entityId));
            if (category) files = files.filter((item) => (item.category || categoryForEntity[item.entityType] || 'GENERAL') === category);
            files = files.map(({ path: ignoredPath, ...item }) => item);
            return {
                ...folder,
                file: (folder.file || []).map(({ path: ignoredPath, ...item }) => item),
                createByName: [folder.createBy?.firstName, folder.createBy?.lastName].filter(Boolean).join(' ') || folder.createBy?.username,
                files,
            };
        }).filter((folder) => (!entityType && !category) || folder.files.length);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load documents', error: error.message });
    }
};

const createFolder = async (req, res) => {
    try {
        const access = await actorScope(req);
        const folderName = String(req.body.folderName || '').trim();
        if (!access) return res.status(401).json({ message: 'Authentication failed' });
        if (!folderName) return res.status(400).json({ message: 'Folder name is required' });
        const parentFolder = req.body.parentFolder && validId(req.body.parentFolder) ? req.body.parentFolder : null;
        if (parentFolder && !await Document.exists({ _id: parentFolder, ...access.query, deleted: false })) return res.status(404).json({ message: 'Parent folder not found' });
        const existing = await Document.findOne({ createBy: access.actor._id, parentFolder, folderName, deleted: false });
        if (existing) return res.status(200).json(existing);
        const folder = await Document.create({ folderName, parentFolder, createBy: access.actor._id, file: [], isRoot: false });
        res.status(201).json(folder);
    } catch (error) {
        res.status(400).json({ message: 'Failed to create folder', error: error.message });
    }
};

const entityFields = (body) => {
    const aliases = {
        Contact: body.linkContact,
        Lead: body.linkLead,
        Property: body.linkProperty,
        Opportunity: body.linkOpportunity,
        PartnerCustomer: body.linkPartnerCustomer,
    };
    let entityType = body.entityType || Object.keys(aliases).find((key) => aliases[key]);
    let entityId = body.entityId || aliases[entityType];
    if (!['Contact', 'Lead', 'Property', 'Opportunity', 'PartnerCustomer'].includes(entityType) || !validId(entityId)) {
        entityType = null;
        entityId = null;
    }
    const result = { entityType, entityId };
    if (entityType === 'Contact') result.linkContact = entityId;
    if (entityType === 'Lead') result.linkLead = entityId;
    if (entityType === 'Property') result.linkProperty = entityId;
    if (entityType === 'Opportunity') result.linkOpportunity = entityId;
    if (entityType === 'PartnerCustomer') result.linkPartnerCustomer = entityId;
    return result;
};

const accessibleRelation = async (actor, relation) => {
    if (!relation.entityId) return true;
    const types = {
        Contact: [require('../../model/schema/contact').Contact, 'Contacts'],
        Lead: [require('../../model/schema/lead').Lead, 'Leads'],
        Property: [require('../../model/schema/property').Property, 'Properties'],
        Opportunity: [require('../../model/schema/opprtunity'), 'Opportunities'],
        PartnerCustomer: [require('../../model/schema/partnerCustomer'), 'Partner Customers'],
    };
    const [model, name] = types[relation.entityType];
    return Boolean(await model.exists(require('../../services/recordAccess').recordScope(actor, name, { _id: relation.entityId, deleted: false })));
};
const file = async (req, res) => {
    try {
        const access = await actorScope(req);
        if (!access) return res.status(401).json({ message: 'Authentication failed' });
        if (!req.files?.length) return res.status(400).json({ message: 'Select at least one file' });
        let folder;
        if (req.body.folderId && validId(req.body.folderId)) {
            folder = await Document.findOne({ _id: req.body.folderId, ...access.query, deleted: false });
        } else {
            folder = await Document.findOne({ createBy: access.actor._id, isRoot: true, deleted: false });
            if (!folder) folder = new Document({ folderName: '__ROOT__', isRoot: true, createBy: access.actor._id, parentFolder: null, file: [] });
        }
        if (!folder) return res.status(404).json({ message: 'Folder not found or access denied' });
        const relation = entityFields(req.body);
        if (!await accessibleRelation(access.actor, relation)) return res.status(404).json({ message: 'Related record not found' });
        const category = categories.has(req.body.category)
            ? req.body.category
            : (categoryForEntity[relation.entityType] || 'GENERAL');
        const customFields = (() => { try { return JSON.parse(req.body.customFields || '{}'); } catch { return {}; } })();
        require('../../middelwares/requestSecurity').assertSafeInput(customFields);
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const files = req.files.map((item) => ({
            fileName: req.body.filename || path.basename(item.originalname),
            path: item.path,
            img: `${baseUrl}/api/document/images/${item.filename}`,
            mimeType: item.mimetype,
            size: item.size,
            createOn: new Date(),
            customFields,
            category,
            ...relation,
        }));
        folder.file.push(...files);
        folder.updatedDate = new Date();
        await folder.save();
        res.status(200).json({ message: 'Files uploaded successfully', folder });
    } catch (error) {
        res.status(500).json({ message: 'Failed to upload files', error: error.message });
    }
};

const compatibilityUpload = (entityType) => async (req, res) => {
    req.body.entityType = entityType;
    req.body.entityId = entityType === 'Contact' ? req.body.linkContact : req.body.linkLead;
    return file(req, res);
};

const findFile = async (req, id) => {
    if (!validId(id)) return null;
    const access = await actorScope(req);
    if (!access) return null;
    const folder = await Document.findOne({ 'file._id': id, ...access.query, deleted: false });
    const found = folder?.file.id(id);
    return found ? { folder, found } : null;
};

const downloadFile = async (req, res) => {
    try {
        const result = await findFile(req, req.params.id);
        if (!result || result.found.deleted) return res.status(404).json({ message: 'File not found' });
        const safePath = withinRoot(uploadRoot, result.found.path) || withinRoot(path.resolve(__dirname, '../../uploads/images'), result.found.path);
        if (!safePath) return res.status(404).json({ message: 'File not found' });
        fileResponseHeaders(res, safePath);
        res.download(safePath, path.basename(result.found.fileName));
    } catch (error) {
        res.status(500).json({ message: 'Failed to download file', error: error.message });
    }
};

const previewFile = async (req, res) => {
    try {
        const access = await actorScope(req);
        if (!access) return res.status(401).json({ message: 'Authentication failed' });
        const filename = req.params.filename;
        if (filename !== path.basename(filename)) return res.status(400).json({ message: 'Invalid file' });
        const escaped = filename.replace(/[.*+?^\x24{}()|[\]\\]/g, '\\$&');
        const folder = await Document.findOne({ ...access.query, deleted: false,
            file: { $elemMatch: { img: { $regex: '/' + escaped + '$' }, deleted: false } },
        });
        if (!folder) return res.status(404).json({ message: 'File not found' });
        fileResponseHeaders(res, filename, true);
        res.sendFile(path.join(uploadRoot, filename));
    } catch (error) {
        res.status(500).json({ message: 'Failed to preview file' });
    }
};

const deleteFile = async (req, res) => {
    try {
        const result = await findFile(req, req.params.id);
        if (!result) return res.status(404).json({ message: 'File not found' });
        result.found.deleted = true;
        result.folder.updatedDate = new Date();
        await result.folder.save();
        res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete file', error: error.message });
    }
};

const linkDocument = async (req, res) => {
    try {
        const result = await findFile(req, req.params.id);
        if (!result) return res.status(404).json({ message: 'File not found' });
        const relation = entityFields(req.body);
        const access = await actorScope(req);
        if (!access || !await accessibleRelation(access.actor, relation)) return res.status(404).json({ message: 'Related record not found' });
        if (!relation.entityId) return res.status(400).json({ message: 'Select a valid record' });
        ['linkContact', 'linkLead', 'linkProperty', 'linkOpportunity', 'linkPartnerCustomer'].forEach((key) => { result.found[key] = null; });
        Object.assign(result.found, relation);
        result.found.category = categoryForEntity[relation.entityType] || result.found.category || 'GENERAL';
        await result.folder.save();
        res.status(200).json({ message: 'Document linked successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to link document', error: error.message });
    }
};

module.exports = {
    upload, validateUploads: validateUploadedDocuments, index, createFolder, file, downloadFile, previewFile, deleteFile, LinkDocument: linkDocument,
    addDocumentContact: compatibilityUpload('Contact'), addDocumentLead: compatibilityUpload('Lead'),
};
