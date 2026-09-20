const FormDefinition = require('../model/schema/formDefinition');
const CustomField = require('../model/schema/customField');
const { categories, ages, bedrooms, floors } = require('./estateCatalog');
const labels = {
  RESIDENTIAL: ['Residential', 'مسکونی', 'Konut'], COMMERCIAL: ['Commercial', 'تجاری', 'Ticari'],
  APARTMENT: ['Apartment', 'آپارتمان', 'Daire'], RESIDENCE: ['Residence', 'رزیدانس', 'Rezidans'], VILLA: ['Villa', 'ویلا', 'Villa'],
  SHOP: ['Shop', 'مغازه', 'Dükkan'], OFFICE: ['Office', 'دفتر', 'Ofis'], SALE: ['For Sale', 'فروش', 'Satılık'], RENT: ['For Rent', 'اجاره', 'Kiralık'],
  EMPTY: ['Empty', 'خالی', 'Boş'], TENANTED: ['Tenant Occupied', 'ملک با مستأجر', 'Kiracılı'], OWNER_OCCUPIED: ['Owner Occupied', 'مالک ساکن', 'Mülk Sahibi Kullanıyor'],
  NET: ['Net', 'خالص', 'Net'], GROSS: ['Gross', 'ناخالص', 'Brüt'], AVAILABLE: ['Available', 'موجود', 'Müsait'], SOLD: ['Sold', 'فروخته‌شده', 'Satıldı'],
  LEAD: ['Lead', 'لید', 'Müşteri Adayı'], PARTNER_CUSTOMER: ['Partner Customer', 'مشتری همکار', 'İş Ortağı Müşterisi'],
  INDIVIDUAL: ['Individual', 'شخص حقیقی', 'Bireysel'], COMPANY: ['Company', 'شرکت', 'Şirket'], ACTIVE: ['Active', 'فعال', 'Aktif'], INACTIVE: ['Inactive', 'غیرفعال', 'Pasif'],
  AGE_0_1: ['0–1 year', '۰ تا ۱ سال', '0–1 yıl'], AGE_1_2: ['1–2 years', '۱ تا ۲ سال', '1–2 yıl'], AGE_2_5: ['2–5 years', '۲ تا ۵ سال', '2–5 yıl'],
  AGE_5_10: ['5–10 years', '۵ تا ۱۰ سال', '5–10 yıl'], AGE_10_20: ['10–20 years', '۱۰ تا ۲۰ سال', '10–20 yıl'], AGE_20_30: ['20–30 years', '۲۰ تا ۳۰ سال', '20–30 yıl'], AGE_30_PLUS: ['30+ years', 'بیش از ۳۰ سال', '30+ yıl'],
  TRY: ['Turkish Lira', 'لیر ترکیه', 'Türk Lirası'], USD: ['US Dollar', 'دلار آمریکا', 'ABD Doları'], EUR: ['Euro', 'یورو', 'Avro'],
  '0': ['Ground / 0', 'همکف / ۰', 'Zemin / 0'],
};
const localized = (en, fa, tr) => ({ en, fa, tr });
const options = values => values.map(value => ({ value, label: localized(...(labels[value] || [value, value, value])) }));
const field = (name, type, en, fa, tr, extra = {}) => ({ name, type, kind: 'SYSTEM_FIELD', enabled: true, required: false, label: localized(en, fa, tr), ...extra });
const required = { required: true, locked: true };
const company = { condition: { customerType: 'COMPANY' } };
const address = () => [field('district', 'text', 'District', 'منطقه', 'İlçe'), field('neighborhood', 'text', 'Neighborhood', 'محله', 'Mahalle')];
const defaults = {
  Properties: [
    field('title', 'text', 'Title', 'عنوان', 'Başlık', required), field('description', 'textarea', 'Description', 'توضیحات', 'Açıklama'),
    field('category', 'select', 'Property Category', 'دسته‌بندی ملک', 'Gayrimenkul Kategorisi', { ...required, options: options(Object.keys(categories)), defaultValue: 'RESIDENTIAL' }),
    field('subtype', 'select', 'Property Subtype', 'نوع ملک', 'Gayrimenkul Türü', { ...required, options: options(Object.values(categories).flat()) }),
    field('transactionType', 'radio', 'Transaction Type', 'نوع معامله', 'İşlem Türü', { ...required, options: options(['SALE', 'RENT']), defaultValue: 'SALE' }),
    field('price.amount', 'currency', 'Price', 'قیمت', 'Fiyat', { ...required, min: 0 }),
    field('price.currency', 'select', 'Currency', 'ارز', 'Para Birimi', { ...required, options: options(['TRY', 'USD', 'EUR']), defaultValue: 'TRY' }),
    ...address(), field('isInsideResidence', 'checkbox', 'Is this property inside a Residence?', 'آیا ملک داخل یک رزیدانس قرار دارد؟', 'Gayrimenkul bir rezidans içerisinde mi?', { locked: true, defaultValue: false }),
    field('residence', 'select', 'Residence', 'رزیدانس', 'Rezidans', { relation: 'Residences', condition: { isInsideResidence: true }, ...required }),
    field('bedroom', 'select', 'Bedroom Type', 'تعداد خواب', 'Oda Sayısı', { options: options(bedrooms), condition: { category: 'RESIDENTIAL' } }),
    field('buildingAge', 'select', 'Building Age', 'عمر ساختمان', 'Bina Yaşı', { options: options(ages) }),
    field('occupancyStatus', 'select', 'Occupancy Status', 'وضعیت سکونت', 'Kullanım Durumu', { options: options(['EMPTY', 'TENANTED', 'OWNER_OCCUPIED']) }),
    field('floor', 'select', 'Floor', 'طبقه', 'Kat', { options: options(floors) }),
    field('area.value', 'number', 'Area (m²)', 'متراژ (متر مربع)', 'Alan (m²)', { ...required, min: 0.01 }),
    field('area.type', 'select', 'Area Type', 'نوع متراژ', 'Alan Türü', { ...required, options: options(['NET', 'GROSS']), defaultValue: 'NET' }),
    field('sale.status', 'select', 'Sale Status', 'وضعیت فروش', 'Satış Durumu', { ...required, options: options(['AVAILABLE', 'SOLD']), defaultValue: 'AVAILABLE' }),
    field('sale.buyerType', 'radio', 'Buyer Type', 'نوع خریدار', 'Alıcı Türü', { ...required, options: options(['LEAD', 'PARTNER_CUSTOMER']), condition: { 'sale.status': 'SOLD' } }),
    field('sale.lead', 'select', 'Lead Buyer', 'لید خریدار', 'Alıcı Adayı', { ...required, relation: 'Leads', condition: { 'sale.status': 'SOLD', 'sale.buyerType': 'LEAD' } }),
    field('sale.partnerCustomer', 'select', 'Partner Customer Buyer', 'مشتری همکار خریدار', 'İş Ortağı Alıcı', { ...required, relation: 'Partner Customers', condition: { 'sale.status': 'SOLD', 'sale.buyerType': 'PARTNER_CUSTOMER' } }),
    field('sale.soldAt', 'date', 'Sale Date', 'تاریخ فروش', 'Satış Tarihi', { condition: { 'sale.status': 'SOLD' } }),
    field('files', 'file', 'Property Files', 'فایل‌های ملک', 'Gayrimenkul Dosyaları'),
  ],
  'Partner Customers': [
    field('customerType', 'radio', 'Customer Type', 'نوع مشتری', 'Müşteri Türü', { ...required, options: options(['INDIVIDUAL', 'COMPANY']), defaultValue: 'INDIVIDUAL' }),
    field('fullName', 'text', 'Full Name', 'نام کامل', 'Ad Soyad', { ...required, condition: { customerType: 'INDIVIDUAL' } }),
    field('companyName', 'text', 'Company Name', 'نام شرکت', 'Şirket Adı', { ...company, ...required }),
    field('contactPerson', 'text', 'Contact Person', 'شخص رابط', 'İlgili Kişi', company),
    field('phone', 'phone', 'Phone', 'تلفن', 'Telefon'), field('whatsapp', 'phone', 'WhatsApp', 'واتس‌اپ', 'WhatsApp'),
    field('email', 'email', 'Email', 'ایمیل', 'E-posta'), field('nationality', 'text', 'Nationality', 'ملیت', 'Uyruk'),
    field('address', 'textarea', 'Address', 'آدرس', 'Adres'), ...address(), field('taxNumber', 'text', 'Tax Number', 'شماره مالیاتی', 'Vergi Numarası', company),
    field('notes', 'textarea', 'Notes', 'یادداشت‌ها', 'Notlar'), field('status', 'select', 'Status', 'وضعیت', 'Durum', { ...required, options: options(['ACTIVE', 'INACTIVE']), defaultValue: 'ACTIVE' }),
  ],
  Residences: [field('name', 'text', 'Name', 'نام', 'Ad', required), ...address(), field('address', 'textarea', 'Address', 'آدرس', 'Adres'), field('notes', 'textarea', 'Notes', 'یادداشت‌ها', 'Notlar')],
};
Object.assign(defaults, require('./completeFormDefinitions')({ field, options, required }));
defaults.Properties.push(
  field('lrNo', 'text', 'L.R. Number', 'شماره ثبتی', 'L.R. Numarası'),
  field('Floor', 'number', 'Legacy Floor Number', 'شماره طبقه قدیمی', 'Eski Kat Numarası'),
  field('yearBuilt', 'number', 'Year Built', 'سال ساخت', 'Yapım Yılı'),
  field('propertyDescription', 'textarea', 'Property Description', 'توضیحات تکمیلی ملک', 'Gayrimenkul Açıklaması'),
  field('parking', 'radio', 'Parking', 'پارکینگ', 'Otopark', { options: options(['Yes', 'No']) }),
  field('flooringType', 'text', 'Flooring Type', 'نوع کف‌پوش', 'Zemin Türü'),
  field('location', 'text', 'Location', 'موقعیت', 'Konum'),
  field('Facility', 'text', 'Facilities', 'امکانات', 'Olanaklar'),
);
const legacyModules = [
  'Leads', 'Contacts', 'Tasks', 'Meetings', 'Calls', 'Emails', 'Opportunities',
  'Invoices', 'Quotes', 'Opportunity Project', 'Bank Details', 'Documents', 'Users',
  'Email Template',
];
const safeName = name => /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/.test(name) && !name.split('.').some(part => ['__proto__', 'prototype', 'constructor', 'password', 'roles', 'createBy', 'deleted'].includes(part));
async function getDefinition(moduleName) {
  const legacy = await CustomField.findOne({ moduleName, deleted: false }).lean();
  const mapLegacyFields = (kind = 'SYSTEM_FIELD') => (legacy?.fields || [])
    .filter(item => safeName(item.name)
      && !item.delete
      && !item.isDefault
      && (kind === 'SYSTEM_FIELD' || !item.fixed))
    .map(item => ({
      ...field(item.name,
        ({ check: 'checkbox', tel: 'phone', range: 'number', 'datetime-local': 'datetime' })[item.type]
          || (require('./estateCatalog').fieldTypes.includes(item.type) ? item.type : 'text'),
        item.label || item.name, item.label || item.name, item.label || item.name, {
          required: item.validation?.some(rule => rule.require) || false,
          locked: kind === 'SYSTEM_FIELD' && Boolean(item.fixed),
          options: item.options?.map(option => ({
            value: String(option.value),
            label: localized(option.name, option.name, option.name),
          })),
          relation: item.ref,
        }),
      kind,
    }));
  const existing = await FormDefinition.findOne({ moduleName }).lean();
  if (existing) {
    const baseline = defaults[moduleName] || [];
    const mergedExisting = existing.fields.map(item => {
      const system = item.kind === 'SYSTEM_FIELD'
        ? baseline.find(candidate => candidate.name === item.name)
        : null;
      return system ? {
        ...item,
        type: system.type,
        relation: system.relation,
        condition: system.condition,
        external: Boolean(system.external),
        locked: Boolean(system.locked),
        ...(system.locked ? { enabled: true, required: Boolean(system.required) } : {}),
      } : item;
    });
    const existingNames = new Set(mergedExisting.map(item => item.name));
    const missing = baseline.filter(item => !existingNames.has(item.name));
    const knownNames = new Set([...existingNames, ...baseline.map(item => item.name)]);
    const legacyCustom = defaults[moduleName]
      ? mapLegacyFields('CUSTOM_FIELD').filter(item => !knownNames.has(item.name))
      : [];
    const additions = [...missing, ...legacyCustom];
    return {
      ...existing,
      fields: [...mergedExisting, ...additions.map((item, index) => ({
        ...item,
        order: mergedExisting.length + index,
      }))],
    };
  }
  if (!defaults[moduleName] && !legacyModules.includes(moduleName) && !legacy) return null;
  let fields;
  if (defaults[moduleName]) {
    const names = new Set(defaults[moduleName].map(item => item.name));
    fields = [
      ...defaults[moduleName],
      ...mapLegacyFields('CUSTOM_FIELD').filter(item => !names.has(item.name)),
    ];
  } else {
    fields = mapLegacyFields('SYSTEM_FIELD');
  }
  if (!fields.length && legacyModules.includes(moduleName)) {
    const modelName = { Users: 'User', Documents: 'Document', 'Email Template': 'EmailTemps' }[moduleName] || moduleName;
    const model = require('mongoose').models[modelName];
    fields = Object.entries(model?.schema.paths || {}).filter(([name, path]) => safeName(name) && !['createdDate', 'updatedDate', 'modifiedDate', '_id', '__v', 'customFields'].includes(name) && ['String', 'Number', 'Boolean', 'Date'].includes(path.instance)).map(([name, path]) => {
      const label = name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
      return field(name, { String: 'text', Number: 'number', Boolean: 'checkbox', Date: 'datetime' }[path.instance], label, label, label, { locked: Boolean(path.isRequired), required: Boolean(path.isRequired) });
    });
  }
  return { moduleName, revision: 0, fields: fields.map((f, order) => ({ ...f, order })) };
}
module.exports = { defaults, legacyModules, getDefinition, localized, safeName };
