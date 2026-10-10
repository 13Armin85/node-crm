const { isAdmin } = require('./userRoles');
const { taskScope } = require('./taskAccess');

// Ownership scopes are retained for mutations and administrator person-specific views.
const personalFields = {
    Contacts: ['createBy'],
    Properties: ['createBy'],
    Residences: ['createBy'],
    'Partner Customers': ['createBy'],
    Leads: ['createBy'],
    Opportunities: ['createBy', 'assignUser'],
    Invoices: ['createBy', 'assignedTo'],
    Meetings: ['createBy'],
    Calls: ['createBy', 'sender', 'salesAgent'],
    Emails: ['createBy', 'sender', 'salesAgent'],
    Documents: ['createBy'],
    Texts: ['createBy', 'sender'],
    TextMsg: ['sender'],
    Quotes: ['createBy', 'assignedTo'],
    BankDetails: ['createBy'],
    'Bank Details': ['createBy'],
    'Opportunity Project': ['createBy'],
    OpportunityProject: ['createBy'],
    OpportunityProjects: ['createBy'],
    'Email Template': ['createBy'],
    EmailTemps: ['createBy'],
};
const recordScope = (actor, moduleName, extra = {}) => {
    if (moduleName === 'Tasks') return taskScope(actor, extra);
    if (isAdmin(actor) || !personalFields[moduleName]) return { ...extra };
    if (!actor?._id) throw new Error('An authenticated actor is required');
    const fields = personalFields[moduleName];
    const owner = fields.length === 1 ? { [fields[0]]: actor._id } : { $or: fields.map(field => ({ [field]: actor._id })) };
    return Object.keys(extra).length ? { $and: [{ ...extra }, owner] } : owner;
};
const readActor = (req, actor) => isAdmin(actor) && req.dataSubject ? { _id: req.dataSubject, role: 'user' } : actor;
const readScope = (req, actor, moduleName, extra = {}) => {
    const { canView, publicModules, canonicalModule, requestViewModule } = require('./moduleVisibility');
    moduleName = canonicalModule(moduleName);
    const currentActor = req.actor || actor;
    const page = requestViewModule(req);
    const restrictedSummary = ['Dashboard', 'Reporting and Analytics'].includes(page) && !canView(currentActor, page);
    if (!canView(currentActor, moduleName) || restrictedSummary) {
        const { idsFor } = require('./recordSharing');
        if (currentActor?.role !== 'user' || !currentActor._id || (!personalFields[moduleName] && moduleName !== 'Tasks' && moduleName !== 'Users')) return { $and: [{ ...extra }, { _id: { $exists: false } }] };
        const own = moduleName === 'Users' ? { _id: currentActor._id } : recordScope(currentActor, moduleName);
        const ids = idsFor(req, moduleName);
        const shared = moduleName === 'Documents' ? { file: { $elemMatch: { _id: { $in: ids }, deleted: { $ne: true } } } } : { _id: { $in: ids } };
        const access = ids.length ? { $or: [own, shared] } : own;
        return Object.keys(extra).length ? { $and: [{ ...extra }, access] } : access;
    }
    if (!isAdmin(actor) || !req.dataSubject || publicModules.has(moduleName)) return { ...extra };
    const subject = readActor(req, actor);
    if (moduleName === 'Users' || moduleName === 'User') return { ...extra, _id: subject._id };
    if (moduleName === 'Contacts') return recordScope(subject, 'Opportunities', extra);
    if (moduleName === 'Properties') return { $and: [{ ...extra }, { $or: [{ createBy: subject._id }, { 'sale.soldBy': subject._id }] }] };
    return recordScope(subject, personalFields[moduleName] || moduleName === 'Tasks' ? moduleName : 'Documents', extra);
};
const routeModules = { contact: 'Contacts', lead: 'Leads', property: 'Properties', quotes: 'Quotes', 'email-temp': 'Email Template', 'bank-details': 'Bank Details', opportunityproject: 'Opportunity Project', 'text-msg': 'Texts', user: 'Users', opportunity: 'Opportunities', opportunities: 'Opportunities', invoices: 'Invoices', meeting: 'Meetings', phoneCall: 'Calls', email: 'Emails', document: 'Documents' };
const requestModule = req => req.params?.module || routeModules[(req.baseUrl || '').split('/').pop()];
module.exports = { recordScope, readScope, readActor, personalFields, requestModule };
