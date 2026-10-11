/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Test saving a real editor form. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from 'i18n';
import AddEdit from './AddEdit';
import { getApi, postApi } from 'services/api';
jest.mock('services/api', () => ({ getApi: jest.fn(), postApi: jest.fn(), putApi: jest.fn(), deleteManyApi: jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('react-email-editor', () => {
  const React = require('react');
  return { EmailEditor: React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ editor: { exportHtml: callback => callback({ html: '<p>Body</p>', design: { body: {} } }) } }));
    return <div>Editor</div>;
  }) };
});
test('required template description and custom fields block saving until all values are present', async () => {
  localStorage.setItem('user', JSON.stringify({ _id: 'admin', role: 'admin' }));
  getApi.mockResolvedValue({ status: 200, data: { moduleName: 'Email Template', fields: [
    { name: 'templateName', kind: 'SYSTEM_FIELD', type: 'text', required: true },
    { name: 'description', kind: 'SYSTEM_FIELD', type: 'text', required: true },
    { name: 'reference', kind: 'CUSTOM_FIELD', type: 'text', required: true, label: { en: 'Reference' }, validationMessage: { en: 'Enter a reference' } },
  ] } });
  postApi.mockResolvedValue({ status: 200, data: {} });
  const container = document.createElement('div'); document.body.appendChild(container);
  try {
    await act(async () => { ReactDOM.render(<ChakraProvider><LanguageProvider><MemoryRouter initialEntries={[{ pathname: '/email-template/add', state: { type: 'add' } }]}><AddEdit /></MemoryRouter></LanguageProvider></ChakraProvider>, container); });
    const save = () => [...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Save');
    const change = async (name, value) => act(async () => Simulate.change(container.querySelector(`input[name="${name}"]`), { target: { value } }));
    await change('templateName', 'My template');
    await act(async () => Simulate.click(save()));
    expect(postApi).not.toHaveBeenCalled(); expect(container.textContent).toContain('Required'); expect(container.textContent).toContain('Enter a reference');
    await change('description', 'Template details'); await change('customFields.reference', 'REF-1');
    await act(async () => Simulate.click(save()));
    expect(postApi).toHaveBeenCalledWith('api/email-temp/add', expect.objectContaining({ templateName: 'My template', description: 'Template details', customFields: { reference: 'REF-1' }, html: '<p>Body</p>' }));
  } finally { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.clear(); }
});
