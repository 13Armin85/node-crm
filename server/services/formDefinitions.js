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
const legacyModules = ['Leads', 'Contacts', 'Tasks', 'Meetings', 'Calls', 'Emails', 'Opportunities', 'Invoices', 'Documents', 'Users', 'Email Template'];
const safeName = name => /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/.test(name) && !name.split('.').some(part => ['__proto__', 'prototype', 'constructor', 'password', 'roles', 'createBy', 'deleted'].includes(part));
async function getDefinition(moduleName) {
  const existing = await FormDefinition.findOne({ moduleName }).lean();
  if (existing) {
    const baseline = defaults[moduleName] || [];
    const existingNames = new Set(existing.fields.map(item => item.name));
    const missing = baseline.filter(item => !existingNames.has(item.name));
    return missing.length ? { ...existing, fields: [...existing.fields, ...missing.map((item, index) => ({ ...item, order: existing.fields.length + index }))] } : existing;
  }
  const legacy = await CustomField.findOne({ moduleName, deleted: false }).lean();
  if (!defaults[moduleName] && !legacyModules.includes(moduleName) && !legacy) return null;
  let fields = defaults[moduleName] || (legacy?.fields || []).filter(f => safeName(f.name)).map(f => field(f.name,
    ({ check: 'checkbox', tel: 'phone', range: 'number', 'datetime-local': 'datetime' })[f.type] || (require('./estateCatalog').fieldTypes.includes(f.type) ? f.type : 'text'),
    f.label || f.name, f.label || f.name, f.label || f.name, {
      required: f.validation?.some(v => v.require) || false, locked: Boolean(f.fixed),
      options: f.options?.map(o => ({ value: String(o.value), label: localized(o.name, o.name, o.name) })),
    }));
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
