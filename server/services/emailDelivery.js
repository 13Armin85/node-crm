const Email = require('../model/schema/email');
const User = require('../model/schema/user');
const { Contact } = require('../model/schema/contact');
const { Lead } = require('../model/schema/lead');
const mail = require('../middelwares/mail');
const { readScope } = require('./recordAccess');
const { objectId, InputError } = require('./estateValidation');

const invalid = (field, code = 'invalid') => { throw new InputError(code, field); };
const optionalId = (value, field) => {
    if (value == null || value === '') return undefined;
    if (!objectId(String(value))) invalid(field);
    return String(value);
};

async function createAndSendEmail(req) {
    const actor = req.actor;
    if (!actor?._id) throw Object.assign(new Error('unauthorized'), { status: 401, code: 'unauthorized' });
    const body = req.body;
    const contactId = optionalId(body.createByContact, 'createByContact');
    const leadId = optionalId(body.createByLead, 'createByLead');
    if (contactId && leadId) invalid('recipient');
    let recipient = body.recipient;
    if (contactId || leadId) {
        const Model = contactId ? Contact : Lead;
        const addressField = contactId ? 'email' : 'leadEmail';
        const selected = await Model.findOne(readScope(req, actor, contactId ? 'Contacts' : 'Leads', {
            _id: contactId || leadId, deleted: false,
        })).select(addressField).lean();
        if (!selected) invalid(contactId ? 'createByContact' : 'createByLead', 'relationNotFound');
        recipient = selected[addressField];
    }
    if (typeof recipient !== 'string' || !recipient.trim()) invalid('recipient', 'required');
    recipient = recipient.trim();
    if (recipient.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(recipient)) invalid('recipient');
    if (typeof body.subject !== 'string' || !body.subject.trim()) invalid('subject', 'required');
    if (body.subject.length > 998 || /[\r\n]/.test(body.subject)) invalid('subject');
    const type = body.type || 'message';
    if (!['message', 'template', 'notification', 'follow-up', 'marketing'].includes(type)) invalid('type');
    const template = type === 'template';
    const content = template ? body.html : body.message;
    if (typeof content !== 'string' || !content.trim()) invalid(template ? 'html' : 'message', 'required');
    const salesAgent = optionalId(body.salesAgent, 'salesAgent');
    if (salesAgent && !await User.exists({ _id: salesAgent, deleted: false })) invalid('salesAgent', 'relationNotFound');
    const property = body.property == null || body.property === '' ? [] : body.property;
    if (!Array.isArray(property) || property.some(id => !objectId(String(id)))) invalid('property');
    const startDate = body.startDate || new Date().toISOString();
    if (typeof startDate !== 'string' || !Number.isFinite(Date.parse(startDate))) invalid('startDate');
    const result = new Email({
        sender: actor._id, createBy: actor._id, recipient, subject: body.subject.trim(), type,
        message: template ? '' : body.message, html: template ? body.html : '',
        createByContact: contactId, createByLead: leadId, salesAgent, property, startDate,
        customFields: body.customFields, deliveryStatus: 'PENDING',
    });
    // Persist and validate before SMTP so database/validation failures cannot send a message.
    await result.save();
    try {
        const delivery = await mail.sendEmail(result.recipient, result.subject,
            template ? undefined : result.message, template ? result.html : undefined);
        if (!delivery) throw Object.assign(new Error('emailNotConfigured'), { code: 'emailNotConfigured', status: 503 });
    } catch (error) {
        const code = error.code === 'emailNotConfigured' ? 'emailNotConfigured' : 'emailSendFailed';
        result.deliveryStatus = 'FAILED';
        result.deliveryError = code;
        try { await result.save(); } catch (saveError) { console.error('Email failure status could not be saved:', saveError.code); }
        throw Object.assign(new Error(code), { status: code === 'emailNotConfigured' ? 503 : 502, code });
    }
    result.deliveryStatus = 'SENT';
    result.sentAt = new Date();
    // SMTP has accepted the email: a bookkeeping failure must not invite a duplicate send.
    try { await result.save(); } catch (error) { console.error('Sent email status could not be saved:', error.code); }
    try { await User.updateOne({ _id: actor._id }, { $inc: { emailsent: 1 } }); }
    catch (error) { console.error('Sent email count could not be updated:', error.code); }
    return result;
}

module.exports = { createAndSendEmail };
