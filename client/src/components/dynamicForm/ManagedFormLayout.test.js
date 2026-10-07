import React from 'react';
import { Grid, GridItem, Input, FormLabel } from '@chakra-ui/react';
import { renderToStaticMarkup } from 'react-dom/server';
import ManagedFormLayout from './ManagedFormLayout';
import { LocalizedText } from 'i18n/runtime';

test('renders native option labels as text rather than React objects', () => {
  const view = renderToStaticMarkup(
    <ManagedFormLayout moduleName="Invoices" formik={{ values: {} }}>
      <select name="status" defaultValue="Paid">
        <option value="Paid"><LocalizedText text="Paid" /></option>
      </select>
    </ManagedFormLayout>,
  );

  expect(view).toContain('>Paid</option>');
  expect(view).not.toContain('[object Object]');
  expect(view).not.toContain('undefined');
});

test('disabled fields remove the complete Chakra grid item without hiding neighboring fields', () => {
  const definition = { fields: [
    { name: 'description', kind: 'SYSTEM_FIELD', enabled: false, type: 'text' },
    { name: 'title', kind: 'SYSTEM_FIELD', type: 'text', label: { en: 'Configured title' } },
  ] };
  const view = renderToStaticMarkup(<ManagedFormLayout moduleName="Invoices" definition={definition} formik={{ values: {} }}>
    <Grid><GridItem data-testid="hidden-row"><FormLabel>Old description</FormLabel><Input name="description" /></GridItem>
      <GridItem><FormLabel>Old title</FormLabel><Input name="title" /></GridItem></Grid>
  </ManagedFormLayout>);
  expect(view).not.toContain('hidden-row');
  expect(view).not.toContain('Old description');
  expect(view).toContain('name="title"');
  expect(view).toContain('Configured title');
});

test('a container with several fields keeps its visible children', () => {
  const definition = { fields: [{ name: 'hidden', kind: 'SYSTEM_FIELD', enabled: false }] };
  const view = renderToStaticMarkup(<ManagedFormLayout moduleName="Invoices" definition={definition} formik={{ values: {} }}>
    <GridItem><GridItem><Input name="hidden" /></GridItem><GridItem><Input name="visible" /></GridItem></GridItem>
  </ManagedFormLayout>);
  expect(view).not.toContain('name="hidden"');
  expect(view).toContain('name="visible"');
});
