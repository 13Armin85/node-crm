import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DynamicFormRenderer from './DynamicFormRenderer';
import { propertySections } from 'views/admin/estate/EntityPage';

const field = (name, type, order, extra = {}) => ({ kind: 'SYSTEM_FIELD', name, type, order, enabled: true, label: { en: name, fa: name, tr: name }, ...extra });
const baseFields = () => [
  field('title', 'text', 0, { required: true }),
  field('description', 'textarea', 1),
  field('category', 'select', 2, { options: [{ value: 'RESIDENTIAL', label: { en: 'Residential' } }] }),
  field('price.amount', 'number', 3),
  field('price.currency', 'select', 4, { options: [{ value: 'TRY', label: { en: 'TRY' } }] }),
  field('district', 'text', 5),
  field('files', 'file', 6),
];
const formik = { values: {}, errors: {}, touched: {}, setFieldValue: jest.fn(), handleBlur: jest.fn() };
const render = fields => renderToStaticMarkup(<DynamicFormRenderer definition={{ moduleName: 'Properties', fields }} formik={formik} sections={propertySections} />);
const sectionOrder = view => [...view.matchAll(/data-section="([^"]+)"/g)].map(match => match[1]);

beforeEach(() => localStorage.setItem('user', JSON.stringify({ role: 'admin' })));
afterEach(() => localStorage.clear());

test('fields are grouped into numbered sections in Form Builder order', () => {
  const view = render(baseFields());
  expect(sectionOrder(view)).toEqual(['basic', 'type', 'price', 'location', 'files']);
  expect(view).toContain('field-title');
  expect(view).toContain('>1</div>');
});

test('deleting all fields of a section in Form Builder removes the section', () => {
  const view = render(baseFields().filter(item => !item.name.startsWith('price.')));
  expect(view).not.toContain('field-price.amount');
  expect(sectionOrder(view)).not.toContain('price');
});

test('disabled fields are hidden and reordering moves their section', () => {
  const fields = baseFields().map(item => item.name === 'district' ? { ...item, enabled: false }
    : item.name === 'files' ? { ...item, order: -1 } : item);
  const view = render(fields);
  expect(view).not.toContain('field-district');
  expect(sectionOrder(view)[0]).toBe('files');
});

test('new custom fields appear in an additional section after the known groups', () => {
  const view = render([...baseFields(), { ...field('field_view', 'select', 2), kind: 'CUSTOM_FIELD', options: [{ value: 'SEA', label: { en: 'Sea' } }] }]);
  expect(view).toContain('field-customFields.field_view');
  expect(sectionOrder(view).at(-1)).toBe('other');
});

test('without sections the renderer keeps the single-grid layout used by other modules', () => {
  const view = renderToStaticMarkup(<DynamicFormRenderer definition={{ moduleName: 'Properties', fields: baseFields() }} formik={formik} />);
  expect(view).not.toContain('crm-form-section');
  expect(view).toContain('field-title');
});
