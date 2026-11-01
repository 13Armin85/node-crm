// Stable domain values shared by validation, definitions and migrations.
const categories = { RESIDENTIAL: ['APARTMENT', 'RESIDENCE', 'VILLA'], COMMERCIAL: ['SHOP', 'OFFICE'] };
const ages = ['AGE_0_1', 'AGE_1_2', 'AGE_2_5', 'AGE_5_10', 'AGE_10_20', 'AGE_20_30', 'AGE_30_PLUS'];
const bedrooms = [
  ...Array.from({ length: 6 }, (_, bedroomCount) => bedroomCount + 1)
    .flatMap(bedroomCount => Array.from({ length: 6 }, (_, livingRoomCount) => `${bedroomCount}+${livingRoomCount + 1}`)),
  '6+',
];
const floors = [...Array.from({ length: 23 }, (_, i) => String(i - 2)), '20+'];
const fieldTypes = ['text', 'textarea', 'number', 'currency', 'select', 'multiselect', 'checkbox', 'radio', 'date', 'datetime', 'email', 'phone', 'file', 'url'];
module.exports = { categories, ages, bedrooms, floors, fieldTypes };
