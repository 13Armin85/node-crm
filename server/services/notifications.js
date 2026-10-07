const Notification = require('../model/schema/notification');

const idOf = value => {
    const id = value?._id || value;
    return id && /^[a-f\d]{24}$/i.test(String(id)) ? String(id) : null;
};

const createNotification = async ({ recipientId, actorId, type, message, status, link, module, entityId }) => {
    if (!idOf(recipientId)) return null;
    try {
        return await Notification.create({
            recipient: recipientId,
            actor: idOf(actorId) || undefined,
            type, message, status, link, module,
            entityId: idOf(entityId) || undefined,
        });
    } catch (error) {
        // A delivery failure must not turn an already saved business operation into an error.
        console.error('Notification delivery failed:', error.message);
        return null;
    }
};

const moduleLinks = {
    Contacts: ['/contacts', '/contactView/'],
    Leads: ['/lead', '/leadView/'],
    Properties: ['/properties', '/propertyView/'],
    'Partner Customers': ['/partner-customers', '/partner-customers/'],
    Residences: ['/residences'],
    Opportunities: ['/opportunities', '/opportunitiesView/'],
    Invoices: ['/invoices', '/invoicesView/'],
    Quotes: ['/invoices'],
    Documents: ['/documents'],
    Meetings: ['/metting', '/metting/'],
    Calls: ['/phone-call', '/phone-call/'],
    Emails: ['/email', '/Email/'],
    Tasks: ['/task', '/view/'],
    Users: ['/default'],
    'Email Template': ['/email-template', '/email-template/'],
};
const notificationLink = (module, id, deleted = false) => {
    const [list, detail] = moduleLinks[module] || ['/default'];
    return !deleted && detail && idOf(id) ? detail + idOf(id) : list;
};
const ownerFields = ['createBy', 'assignUser', 'assignedTo', 'assignedToUser', 'salesAgent', 'sender'];
const owners = record => ownerFields.map(key => idOf(record?.[key])).filter(Boolean);
const assignee = record => idOf(record?.assignUser || record?.assignedTo || record?.assignedToUser || record?.salesAgent);
const statusOf = record => record?.sale?.status || record?.leadStatus || record?.salesStage || record?.invoiceStatus || record?.status;
const recordName = record => record?.title || record?.leadName || record?.opportunityName
    || record?.fullName || record?.companyName || record?.name || record?.agenda || record?.subject
    || record?.templateName || record?.folderName || [record?.firstName, record?.lastName].filter(Boolean).join(' ')
    || record?.invoiceNumber || record?.fileName || '';

const notifyRecordActivity = async ({ module, record, previous, actorId, type = 'record_updated' }) => {
    if (!record) return;
    const actor = idOf(actorId);
    const newAssignee = assignee(record);
    const assignmentChanged = type !== 'record_deleted' && newAssignee && newAssignee !== assignee(previous);
    const statusChanged = previous && statusOf(record) !== statusOf(previous);
    const eventType = type === 'record_updated' && statusChanged
        ? (module === 'Properties' && record.sale?.status === 'SOLD' ? 'property_sold' : 'record_status_changed')
        : type;
    const recipients = [...new Set([actor, ...owners(record), ...owners(previous)].filter(Boolean))];
    await Promise.all(recipients.map(recipientId => createNotification({
        recipientId, actorId: actor, module,
        entityId: record._id,
        type: assignmentChanged && recipientId === newAssignee && recipientId !== actor ? 'record_assigned' : eventType,
        message: String(recordName(record) || module),
        status: eventType === 'record_status_changed' || eventType === 'property_sold' ? String(statusOf(record) || '') : undefined,
        link: notificationLink(module, record._id, type === 'record_deleted' || (owners(previous).includes(recipientId) && !owners(record).includes(recipientId) && recipientId !== actor)),
    })));
};

module.exports = { createNotification, notifyRecordActivity, notificationLink, idOf };
