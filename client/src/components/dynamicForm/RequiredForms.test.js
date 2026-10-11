/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Test the real Formik submit flow. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { useFormik } from 'formik';
import { ChakraProvider, Grid, GridItem, Input, FormLabel } from '@chakra-ui/react';
import ManagedFormLayout from './ManagedFormLayout';
import DynamicFormRenderer from './DynamicFormRenderer';
const field = { name: 'notes', kind: 'SYSTEM_FIELD', type: 'text', enabled: true, required: true, label: { en: 'Notes' }, validationMessage: { en: 'Enter notes before saving' } };
const submit = jest.fn();
function Form({ dynamic }) {
  const formik = useFormik({ initialValues: {}, onSubmit: submit });
  const definition = { moduleName: 'Invoices', fields: [field] };
  return <><ManagedFormLayout moduleName="Invoices" definition={definition} formik={formik} includeCustom={false}>
    {!dynamic && <Grid><GridItem><FormLabel>Notes</FormLabel><Input name="notes" value={formik.values.notes || ''} onChange={formik.handleChange} /></GridItem></Grid>}
  </ManagedFormLayout>{dynamic && <DynamicFormRenderer definition={definition} formik={formik} />}<button onClick={formik.handleSubmit}>Save</button></>;
}
test.each([false, true])('an administrator-required field blocks untouched submission and shows an inline error (dynamic: %s)', async dynamic => {
  submit.mockClear();
  const container = document.createElement('div'); document.body.appendChild(container);
  try {
    await act(async () => ReactDOM.render(<ChakraProvider><Form dynamic={dynamic} /></ChakraProvider>, container));
    await act(async () => Simulate.click(container.querySelector('button')));
    expect(submit).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Enter notes before saving');
    const input = container.querySelector('input[name="notes"]');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    await act(async () => Simulate.change(input, { target: { name: 'notes', value: 'Completed' } }));
    await act(async () => Simulate.click(container.querySelector('button')));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Completed' }), expect.any(Object));
  } finally { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); }
});
