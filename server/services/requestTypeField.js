module.exports = {
  name: 'listedFor', type: 'select', kind: 'SYSTEM_FIELD', enabled: true, required: false,
  label: { en: 'Request Type', fa: 'نوع درخواست', tr: 'Talep Türü' },
  options: [
    { value: 'Buy', label: { en: 'Buy', fa: 'خرید', tr: 'Satın alma' } },
    { value: 'Rent', label: { en: 'Rent', fa: 'اجاره', tr: 'Kiralama' } },
  ],
};
