import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DynamicFormRenderer from './DynamicFormRenderer';

const definition = {
  moduleName: 'Tasks',
  fields: [
    { kind: 'SYSTEM_FIELD', name: 'title', type: 'text', label: 'Title' },
    { kind: 'SYSTEM_FIELD', name: 'assignedToUser', type: 'select', relation: 'Users', label: 'Assigned User' },
    { kind: 'SYSTEM_FIELD', name: 'delegatedBy', type: 'select', relation: 'Users', label: 'Delegated By' },
  ],
};
const formik = { values: {}, errors: {}, setFieldValue: jest.fn(), handleBlur: jest.fn() };
afterEach(() => localStorage.clear());

test.each(['user', 'admin', 'developer'])('task form applies assignment controls for %s', role => {
  localStorage.setItem('user', JSON.stringify({ role }));
  const view = renderToStaticMarkup(<DynamicFormRenderer definition={definition} formik={formik} />);
  expect(view).toContain('field-title');
  expect(view.includes('field-assignedToUser')).toBe(role !== 'user');
  expect(view).not.toContain('field-delegatedBy');
});

test('ordinary users can still see the assignee and delegator in a read-only task', () => {
  localStorage.setItem('user', JSON.stringify({ role: 'user' }));
  const view = renderToStaticMarkup(<DynamicFormRenderer definition={definition} formik={formik} readOnly />);
  expect(view).toContain('field-assignedToUser');
  expect(view).toContain('field-delegatedBy');
  expect(view).toContain('disabled');
});
