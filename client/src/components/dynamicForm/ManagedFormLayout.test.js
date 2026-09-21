import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ManagedFormLayout from './ManagedFormLayout';
import { LocalizedText } from 'i18n/runtime';

test('renders native option labels as text rather than React objects', () => {
  const html = renderToStaticMarkup(
    <ManagedFormLayout moduleName="Invoices" formik={{ values: {} }}>
      <select name="status" defaultValue="Paid">
        <option value="Paid"><LocalizedText text="Paid" /></option>
      </select>
    </ManagedFormLayout>,
  );

  expect(html).toContain('>Paid</option>');
  expect(html).not.toContain('[object Object]');
  expect(html).not.toContain('undefined');
});
