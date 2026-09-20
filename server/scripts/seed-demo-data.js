const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo data seeding is disabled in production.');
}

const SEED_NAMESPACE = 'crm-demo-v1';
const RECORD_COUNT = 10;
const demoPassword = process.env.DEMO_USER_PASSWORD || 'Test@123456';

const objectId = (collection, index) => {
  const hex = crypto
    .createHash('sha256')
    .update(`${SEED_NAMESPACE}:${collection}:${index}`)
    .digest('hex')
    .slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
};

const dateFor = (index, hour = 9) => {
  const value = new Date();
  value.setDate(value.getDate() + index - 4);
  value.setHours(hour, 30, 0, 0);
  return value;
};

const rows = (collection, makeRow) =>
  Array.from({ length: RECORD_COUNT }, (_, offset) => {
    const index = offset + 1;
    return {
      _id: objectId(collection, index),
      _seedNamespace: SEED_NAMESPACE,
      _seedIndex: index,
      ...makeRow(index),
    };
  });

async function replaceSeedRows(db, collectionName, documents) {
  const collection = db.collection(collectionName);
  await collection.bulkWrite(
    documents.map((document) => ({
      replaceOne: {
        filter: { _id: document._id },
        replacement: document,
        upsert: true,
      },
    })),
  );
  return documents;
}

const idAt = (collection, index) => objectId(collection, index);

const faNames = [
  ['آرمان', 'احمدی'], ['سارا', 'محمدی'], ['کیان', 'رضایی'], ['نیلوفر', 'کریمی'],
  ['سامان', 'مرادی'], ['رها', 'حسینی'], ['بردیا', 'جعفری'], ['مهسا', 'صادقی'],
  ['پرهام', 'قاسمی'], ['یلدا', 'اکبری'],
];

async function seedUsers(db, adminId) {
  const password = await bcrypt.hash(demoPassword, 10);
  const users = rows('User', (index) => ({
    username: `demo.user${index}@crm.test`,
    password,
    role: index === 1 ? 'admin' : 'user',
    firstName: faNames[index - 1][0],
    lastName: faNames[index - 1][1],
    phoneNumber: Number(`90555010${String(index).padStart(2, '0')}`),
    emailsent: index * 2,
    textsent: index * 3,
    outboundcall: index * 4,
    customFields: { department: index % 2 ? 'فروش' : 'پشتیبانی', seededBy: String(adminId) },
    createdDate: dateFor(-index),
    updatedDate: new Date(),
    deleted: false,
  }));
  return replaceSeedRows(db, 'User', users);
}

function staticData(adminId, userIds) {
  const residences = rows('Residences', (index) => ({
    name: `مجتمع مسکونی نمونه ${index}`,
    district: ['Kadikoy', 'Besiktas', 'Sisli', 'Uskudar'][index % 4],
    neighborhood: `محله ${index}`,
    address: `استانبول، خیابان نمونه، پلاک ${10 + index}`,
    notes: `مجتمع تستی شماره ${index} با امکانات کامل`,
    customFields: { blocks: 2 + index, parking: true },
    createBy: adminId,
    createdDate: dateFor(-index),
    updatedDate: new Date(),
    deleted: false,
  }));

  const partners = rows('PartnerCustomers', (index) => ({
    customerType: index % 3 === 0 ? 'COMPANY' : 'INDIVIDUAL',
    fullName: `${faNames[index - 1][0]} ${faNames[index - 1][1]}`,
    companyName: index % 3 === 0 ? `شرکت سرمایه‌گذاری نمونه ${index}` : '',
    contactPerson: `${faNames[index - 1][0]} ${faNames[index - 1][1]}`,
    phone: `+90 555 200 ${String(index).padStart(4, '0')}`,
    whatsapp: `+90 555 200 ${String(index).padStart(4, '0')}`,
    email: `customer${index}@crm.test`,
    nationality: index % 2 ? 'Iranian' : 'Turkish',
    address: `نشانی کامل مشتری شماره ${index}، استانبول`,
    district: ['Kadikoy', 'Besiktas', 'Sisli'][index % 3],
    neighborhood: `محله مشتری ${index}`,
    taxNumber: `TR-${100000 + index}`,
    notes: `مشتری آزمایشی با اولویت ${index % 3 + 1}`,
    status: index === 10 ? 'INACTIVE' : 'ACTIVE',
    customFields: { preferredLanguage: index % 2 ? 'fa' : 'tr', budgetLevel: 'premium' },
    contacts: [idAt('Contacts', index)],
    leads: [idAt('Leads', index)],
    opportunities: [idAt('Opportunities', index)],
    properties: [idAt('Properties', index)],
    createBy: adminId,
    createdDate: dateFor(-index),
    updatedDate: new Date(),
    deleted: false,
  }));

  const contacts = rows('Contacts', (index) => ({
    fullName: `${faNames[index - 1][0]} ${faNames[index - 1][1]}`,
    firstName: faNames[index - 1][0],
    lastName: faNames[index - 1][1],
    email: `contact${index}@crm.test`,
    phoneNumber: Number(`90555300${String(index).padStart(2, '0')}`),
    mobileNumber: Number(`90555400${String(index).padStart(2, '0')}`),
    campaign: ['Referral', 'Online', 'Billboard', 'Agent'][index % 4],
    state: ['Open', 'Waiting', 'Booked', 'Parking'][index % 4],
    communicationTool: ['WhatsApp', 'Email', 'Visit'][index % 3],
    listedFor: index % 2 ? 'Buy' : 'Rent',
    message: `یادداشت کامل مخاطب آزمایشی شماره ${index}`,
    interestProperty: [idAt('Properties', index)],
    relatedLeads: [idAt('Leads', index)],
    relatedOpportunities: [idAt('Opportunities', index)],
    relatedProperties: [idAt('Properties', index)],
    partnerCustomer: idAt('PartnerCustomers', index),
    customFields: { preferredTime: '10:00-16:00', sourceDetail: 'Demo seed' },
    createBy: adminId,
    createdDate: dateFor(-index),
    updatedDate: new Date(),
    deleted: false,
  }));

  const properties = rows('Properties', (index) => {
    const sold = index % 3 === 0;
    const commercial = index % 4 === 0;
    return {
      title: `${commercial ? 'دفتر اداری' : 'آپارتمان'} تستی شماره ${index}`,
      name: `${commercial ? 'دفتر اداری' : 'آپارتمان'} تستی شماره ${index}`,
      lrNo: `LR-DEMO-${String(index).padStart(3, '0')}`,
      status: sold ? 'Sold' : 'Available',
      description: `ملک نمونه شماره ${index} با نورگیری مناسب و دسترسی کامل`,
      propertyDescription: `توضیحات تکمیلی ملک آزمایشی ${index}`,
      category: commercial ? 'COMMERCIAL' : 'RESIDENTIAL',
      subtype: commercial ? 'OFFICE' : index % 5 === 0 ? 'VILLA' : 'APARTMENT',
      transactionType: index % 2 ? 'SALE' : 'RENT',
      price: { amount: 2500000 + index * 375000, currency: index % 3 === 0 ? 'USD' : 'TRY' },
      district: ['Kadikoy', 'Besiktas', 'Sisli', 'Uskudar'][index % 4],
      neighborhood: `محله ملک ${index}`,
      isInsideResidence: !commercial,
      residence: !commercial ? idAt('Residences', index) : null,
      bedroom: commercial ? null : ['1+1', '2+1', '3+1'][index % 3],
      occupancyStatus: ['EMPTY', 'TENANTED', 'OWNER_OCCUPIED'][index % 3],
      area: { value: 65 + index * 11, type: index % 2 ? 'NET' : 'GROSS', unit: 'M2' },
      sale: {
        status: sold ? 'SOLD' : 'AVAILABLE',
        buyerType: sold ? 'PARTNER_CUSTOMER' : null,
        lead: null,
        partnerCustomer: sold ? idAt('PartnerCustomers', index) : null,
        soldAt: sold ? dateFor(-index) : null,
        soldBy: sold ? userIds[(index - 1) % userIds.length] : null,
      },
      Floor: index,
      floor: String(Math.min(index, 10)),
      yearBuilt: 2014 + index,
      parking: index % 2 ? 'Yes' : 'No',
      flooringType: index % 2 ? 'پارکت' : 'سرامیک',
      location: `استانبول، منطقه ${index}`,
      Facility: 'پارکینگ، آسانسور، نگهبانی',
      customFields: { furnished: index % 2 === 0, viewingCode: `VIEW-${index}` },
      relatedContacts: [idAt('Contacts', index)],
      relatedLeads: [idAt('Leads', index)],
      relatedOpportunities: [idAt('Opportunities', index)],
      partnerCustomers: [idAt('PartnerCustomers', index)],
      propertyPhotos: [], virtualToursOrVideos: [], floorPlans: [], propertyDocuments: [],
      unitType: [], units: [], files: [],
      createBy: adminId,
      createdDate: dateFor(-index),
      updatedDate: new Date(),
      deleted: false,
    };
  });

  const leads = rows('Leads', (index) => ({
    leadName: `سرنخ ${faNames[index - 1][0]} ${faNames[index - 1][1]}`,
    leadEmail: `lead${index}@crm.test`,
    leadMobile: `+90 555 500 ${String(index).padStart(4, '0')}`,
    leadPhoneNumber: `+90 555 500 ${String(index).padStart(4, '0')}`,
    leadStatus: ['active', 'pending', 'sold'][index % 3],
    leadCampaign: ['Referral', 'Online', 'Billboard', 'Activation', 'Agent'][index % 5],
    leadState: ['Open', 'Waiting', 'Booked', 'Parking'][index % 4],
    communicationTool: ['WhatsApp', 'Email', 'Virtual Meet', 'Visit'][index % 4],
    listedFor: index % 2 ? 'Buy' : 'Rent',
    propertyType: index % 4 === 0 ? 'Land' : 'Apartment',
    leadMessage: `درخواست بازدید و مشاوره برای گزینه شماره ${index}`,
    assignUser: userIds[(index - 1) % userIds.length],
    contact: idAt('Contacts', index),
    partnerCustomer: idAt('PartnerCustomers', index),
    associatedListing: idAt('Properties', index),
    relatedOpportunities: [idAt('Opportunities', index)],
    customFields: { score: 50 + index * 5, nextAction: 'تماس پیگیری' },
    createBy: adminId,
    createdDate: dateFor(-index),
    updatedDate: new Date(),
    deleted: false,
  }));

  const opportunities = rows('Opportunities', (index) => ({
    opportunityName: `فرصت فروش نمونه ${index}`,
    accountName: idAt('PartnerCustomers', index),
    contact: idAt('Contacts', index),
    lead: idAt('Leads', index),
    properties: [idAt('Properties', index)],
    assignUser: userIds[(index - 1) % userIds.length],
    type: index % 2 ? 'New Business' : 'Existing Business',
    leadSource: ['Online', 'Referral', 'Agent'][index % 3],
    currency: index % 3 === 0 ? 'USD' : 'TRY',
    opportunityAmount: String(500000 + index * 125000),
    amount: String(500000 + index * 125000),
    expectedCloseDate: dateFor(index + 10),
    nextStep: index % 2 ? 'بازدید ملک' : 'ارسال پیشنهاد قیمت',
    salesStage: ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won'][index % 5],
    probability: String(20 + index * 7),
    description: `شرح کامل فرصت فروش آزمایشی شماره ${index}`,
    customFields: { priority: index < 4 ? 'high' : 'normal' },
    createBy: adminId,
    modifiedBy: adminId,
    createdDate: dateFor(-index),
    modifiedDate: new Date(),
    deleted: false,
  }));

  return { residences, partners, contacts, properties, leads, opportunities };
}

async function seedDocuments(db, adminId) {
  const uploadRoot = path.resolve(__dirname, '../uploads/document');
  await fs.promises.mkdir(uploadRoot, { recursive: true });

  const documents = [];
  for (let index = 1; index <= RECORD_COUNT; index += 1) {
    const storageName = `demo-document-${index}.txt`;
    const filePath = path.join(uploadRoot, storageName);
    const content = `CRM demo document ${index}\nGenerated by ${SEED_NAMESPACE}.\n`;
    await fs.promises.writeFile(filePath, content, 'utf8');
    documents.push({
      _id: idAt('Document', index),
      _seedNamespace: SEED_NAMESPACE,
      _seedIndex: index,
      folderName: `پوشه آزمایشی ${index}`,
      parentFolder: null,
      file: [{
        _id: idAt('DocumentFile', index),
        fileName: `سند-نمونه-${index}.txt`,
        path: filePath,
        mimeType: 'text/plain',
        size: Buffer.byteLength(content),
        createOn: dateFor(-index),
        deleted: false,
        entityType: index % 2 ? 'Contact' : 'Lead',
        entityId: index % 2 ? idAt('Contacts', index) : idAt('Leads', index),
        ...(index % 2 ? { linkContact: idAt('Contacts', index) } : { linkLead: idAt('Leads', index) }),
        customFields: { documentType: 'demo' },
      }],
      createBy: adminId,
      createdDate: dateFor(-index),
      updatedDate: new Date(),
      deleted: false,
    });
  }
  return replaceSeedRows(db, 'Document', documents);
}

function valueForDynamicField(field, index, adminId) {
  if (field.ref === 'User') return adminId;
  if (field.ref === 'Contacts' || field.ref === 'Contact') return idAt('Contacts', index);
  if (field.ref === 'Leads' || field.ref === 'Lead') return idAt('Leads', index);
  if (field.ref === 'Properties') return idAt('Properties', index);
  if (field.ref === 'PartnerCustomers') return idAt('PartnerCustomers', index);
  if (field.options?.length) return field.options[index % field.options.length].value;
  if (field.backendType === 'Number') return index * 100;
  if (field.backendType === 'Boolean') return index % 2 === 0;
  if (field.backendType === 'Date') return dateFor(index);
  if (field.backendType === 'ObjectId') return adminId;
  return `داده آزمایشی ${field.label || field.name} ${index}`;
}

async function seedDynamicModules(db, adminId) {
  const ignored = new Set(['Leads', 'Contacts', 'Properties', 'Account', 'Accounts', 'Payments']);
  const definitions = await db.collection('CustomField').find({ deleted: false }).toArray();
  const summary = {};

  for (const definition of definitions.filter((item) => !ignored.has(item.moduleName))) {
    const documents = rows(`dynamic:${definition.moduleName}`, (index) => {
      const values = {};
      for (const field of definition.fields || []) {
        if (field.name && !field.delete) values[field.name] = valueForDynamicField(field, index, adminId);
      }
      return {
        ...values,
        customFields: { seeded: true, recordNumber: index },
        createBy: adminId,
        createdDate: dateFor(-index),
        updatedDate: new Date(),
        deleted: false,
      };
    });
    await replaceSeedRows(db, definition.moduleName, documents);
    summary[definition.moduleName] = documents.length;
  }
  return summary;
}

async function run() {
  await mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1:27017', {
    dbName: process.env.DB || 'Prolink',
  });
  const db = mongoose.connection.db;

  let admin = await db.collection('User').findOne({ role: 'admin', deleted: false });
  if (!admin) {
    const password = process.env.INITIAL_ADMIN_PASSWORD || demoPassword;
    const adminDocument = {
      _id: objectId('Admin', 1),
      username: (process.env.INITIAL_ADMIN_EMAIL || 'admin@crm.test').toLowerCase(),
      password: await bcrypt.hash(password, 10),
      role: 'admin', firstName: 'System', lastName: 'Administrator',
      createdDate: new Date(), updatedDate: new Date(), deleted: false,
    };
    await replaceSeedRows(db, 'User', [adminDocument]);
    admin = adminDocument;
  }

  const users = await seedUsers(db, admin._id);
  const userIds = users.map((item) => item._id);
  // The first known demo account is an administrator and owns all demo rows,
  // so a tester can inspect every seeded tab with one login.
  const seedActorId = userIds[0];
  const data = staticData(seedActorId, userIds);
  const summary = { Users: users.length };

  for (const [collectionName, documents] of Object.entries({
    Residences: data.residences,
    PartnerCustomers: data.partners,
    Contacts: data.contacts,
    Properties: data.properties,
    Leads: data.leads,
    Opportunities: data.opportunities,
  })) {
    await replaceSeedRows(db, collectionName, documents);
    summary[collectionName] = documents.length;
  }

  const opportunityProjects = rows('OpportunityProjects', (index) => ({
    name: `پروژه فرصت نمونه ${index}`, requirement: `نیازمندی کامل پروژه شماره ${index}`,
    category: index % 2 ? 'Residential' : 'Commercial', property: [idAt('Properties', index)],
    contact: idAt('Contacts', index), lead: idAt('Leads', index),
    createdDate: dateFor(-index), modifiedDate: new Date(), deleted: false,
  }));
  const quotes = rows('Quotes', (index) => ({
    lead: idAt('Leads', index), contact: idAt('Contacts', index), property: idAt('Properties', index),
    category: index % 2 ? 'Sale' : 'Rent', accountName: `حساب نمونه ${index}`,
    accountNumber: 10000000 + index, swiftCode: 200000 + index,
    amount: 500000 + index * 75000, unitPrice: 500000 + index * 75000,
    bank: ['Ziraat', 'Garanti', 'Isbank'][index % 3], branch: `شعبه ${index}`,
    installments: [{ no: 1, months: '12', per: 50, startDate: dateFor(index), total: 250000 + index * 37500 }],
    description: `پیشنهاد قیمت کامل شماره ${index}`, createBy: seedActorId,
    createdDate: dateFor(-index), updatedDate: new Date(), deleted: false,
  }));
  const invoices = rows('Invoices', (index) => ({
    title: `فاکتور آزمایشی ${index}`, description: `شرح خدمات و ملک فاکتور شماره ${index}`,
    quoteNumber: `Q-${2026000 + index}`, invoiceNumber: `INV-${2026000 + index}`,
    quoteDate: dateFor(-index), invoiceDate: dateFor(-index), dueDate: dateFor(index + 7),
    status: index % 3 === 0 ? 'Paid' : 'Pending', invoiceStatus: index % 3 === 0 ? 'Paid' : 'Sent',
    billingStreet: `خیابان صورتحساب ${index}`, billingCity: 'Istanbul', billingState: 'Istanbul',
    billingPostalCode: `340${String(index).padStart(2, '0')}`, billingCountry: 'Turkey',
    shippingStreet: `خیابان ارسال ${index}`, shippingCity: 'Istanbul', shippingState: 'Istanbul',
    shippingPostalCode: `341${String(index).padStart(2, '0')}`, shippingCountry: 'Turkey',
    lineItems: `خدمات مشاوره و فروش ملک ${index}`, subtotal: String(400000 + index * 50000),
    discount: '5', tax: '20', shipping: '0', grandTotal: String(456000 + index * 57000),
    total: String(456000 + index * 57000), currency: index % 3 === 0 ? 'USD' : 'TRY',
    paymentTerms: 'Net 30', approvalStatus: 'Approved', discountType: 'Percentage',
    items: [{ name: `ملک شماره ${index}`, quantity: 1, price: 400000 + index * 50000 }],
    account: idAt('PartnerCustomers', index), contact: idAt('Contacts', index), quotesId: idAt('Quotes', index),
    assignedTo: userIds[(index - 1) % userIds.length], createBy: seedActorId, modifiedBy: seedActorId,
    isCheck: index % 3 === 0, customFields: { paymentMethod: 'Bank Transfer' },
    createdDate: dateFor(-index), updatedDate: new Date(), deleted: false,
  }));
  const tasks = rows('Tasks', (index) => ({
    title: `پیگیری مشتری شماره ${index}`, category: ['None', 'Contact', 'Lead'][index % 3],
    description: `شرح کامل وظیفه آزمایشی شماره ${index}`, notes: `یادداشت اجرایی ${index}`,
    assignTo: idAt('Contacts', index), assignToLead: idAt('Leads', index),
    assignedToUser: userIds[(index - 1) % userIds.length], delegatedBy: seedActorId,
    reminder: '30 minutes before', start: dateFor(index, 9).toISOString(), end: dateFor(index, 10).toISOString(),
    backgroundColor: '#4318FF', borderColor: '#4318FF', textColor: '#FFFFFF', display: 'block', allDay: false,
    status: ['todo', 'inProgress', 'pending', 'onHold', 'completed'][index % 5],
    customFields: { priority: index < 4 ? 'high' : 'normal' }, createBy: seedActorId,
    createdDate: dateFor(-index), updatedDate: new Date(), deleted: false,
  }));
  const meetings = rows('Meetings', (index) => ({
    agenda: `جلسه مشاوره ملک شماره ${index}`, attendes: [idAt('Contacts', index)],
    attendesLead: [idAt('Leads', index)], location: index % 2 ? 'دفتر مرکزی' : 'جلسه آنلاین',
    related: `فرصت فروش شماره ${index}`, dateTime: dateFor(index, 11).toISOString(),
    notes: `دستور جلسه و یادداشت کامل جلسه ${index}`, customFields: { meetingType: 'Sales' },
    createBy: seedActorId, timestamp: dateFor(-index), deleted: false,
  }));
  const calls = rows('Calls', (index) => ({
    sender: seedActorId, recipient: `${faNames[index - 1][0]} ${faNames[index - 1][1]}`,
    callDuration: `${5 + index}:00`, callNotes: `نتیجه تماس آزمایشی شماره ${index}`,
    phoneNumber: `+90 555 600 ${String(index).padStart(4, '0')}`,
    property: [idAt('Properties', index)], startDate: dateFor(index, 13).toISOString(),
    createByLead: idAt('Leads', index), createByContact: idAt('Contacts', index),
    createBy: seedActorId, salesAgent: userIds[(index - 1) % userIds.length],
    customFields: { outcome: index % 2 ? 'Answered' : 'Follow-up' }, timestamp: dateFor(-index), deleted: false,
  }));
  const emails = rows('Emails', (index) => ({
    sender: seedActorId, recipient: `contact${index}@crm.test`, subject: `پیشنهاد اختصاصی ملک شماره ${index}`,
    type: 'outbound', property: [idAt('Properties', index)], startDate: dateFor(index, 14).toISOString(),
    message: `متن کامل ایمیل آزمایشی برای مشتری شماره ${index}`,
    html: `<p>پیشنهاد اختصاصی ملک شماره ${index}</p>`,
    createByLead: idAt('Leads', index), createByContact: idAt('Contacts', index),
    salesAgent: userIds[(index - 1) % userIds.length], createBy: seedActorId,
    customFields: { campaign: 'Demo campaign' }, timestamp: dateFor(-index), deleted: false,
  }));
  const emailTemplates = rows('EmailTemps', (index) => ({
    templateName: `قالب ایمیل نمونه ${index}`, description: `قالب آماده برای پیگیری مشتری نوع ${index}`,
    design: { body: { rows: [], values: { backgroundColor: '#ffffff' } } },
    html: `<h1>سلام {{name}}</h1><p>این قالب آزمایشی شماره ${index} است.</p>`,
    customFields: { category: index % 2 ? 'Follow-up' : 'Welcome' },
    createBy: seedActorId, createdDate: dateFor(-index), deleted: false,
  }));
  const bankDetails = rows('BankDetails', (index) => ({
    accountName: `حساب شرکت نمونه ${index}`, accountNumber: 70000000 + index,
    swiftCode: 900000 + index, bank: ['Ziraat', 'Garanti', 'Isbank'][index % 3],
    branch: `شعبه مرکزی ${index}`, createBy: seedActorId, deleted: false,
    createdAt: dateFor(-index), updatedAt: new Date(),
  }));
  const validations = rows('Validation', (index) => ({
    name: `demo_validation_${index}`,
    validations: [{
      require: true,
      min: index % 2 === 0,
      max: index % 3 === 0,
      value: index,
      message: `پیام اعتبارسنجی آزمایشی شماره ${index}`,
      match: false,
      formikType: index % 2 ? 'String' : 'Number',
    }],
    createdDate: dateFor(-index),
    updatedDate: new Date(),
    deleted: false,
  }));

  for (const [collectionName, documents] of Object.entries({
    OpportunityProjects: opportunityProjects, Quotes: quotes, Invoices: invoices, Tasks: tasks,
    Meetings: meetings, Calls: calls, Emails: emails, EmailTemps: emailTemplates, BankDetails: bankDetails,
    Validation: validations,
  })) {
    await replaceSeedRows(db, collectionName, documents);
    summary[collectionName] = documents.length;
  }

  const documents = await seedDocuments(db, seedActorId);
  summary.Document = documents.length;
  Object.assign(summary, await seedDynamicModules(db, seedActorId));

  console.log(JSON.stringify({
    success: true,
    namespace: SEED_NAMESPACE,
    recordsPerModule: RECORD_COUNT,
    demoUserPassword: demoPassword,
    summary,
  }, null, 2));
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
