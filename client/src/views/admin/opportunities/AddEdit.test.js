/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act */
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import AddEdit from './AddEdit';
import { getApi } from 'services/api';
jest.mock('react-redux', () => ({ useSelector: () => [] }));
jest.mock('services/api', () => ({ getApi: jest.fn(), postApi: jest.fn(), putApi: jest.fn() }));

test('editing an opportunity resolves existing customer, user and property selections beyond the loaded lists', async () => {
  localStorage.setItem('user', JSON.stringify({ _id: 'admin', role: 'admin' }));
  const ids = { contact: '6ae380a7f48a9ea51d6e3143', user: '6ad5cede20944f7bf63f495d',
    property: '6ae1b409f48a9ea51d6dc631', partner: '6ae1b409f48a9ea51d6dc632' };
  getApi.mockImplementation(async url => ({ status: 200, data: url.includes('/definitions/') ? { moduleName: 'Opportunities', fields: [] }
    : url === 'api/opportunity/view/' ? { opportunityName: 'Villa Sale', contact: ids.contact, accountName: ids.partner,
      assignUser: ids.user, properties: [ids.property] }
      : url.includes('/options?id=') ? [{ value: url.split('id=')[1], label: url.includes('Contacts') ? 'Buyer Name'
        : url.includes('Users') ? 'Assigned Agent' : url.includes('Properties') ? 'Garden Villa' : 'Partner Company' }] : [] }));
  const container = document.createElement('div'); document.body.appendChild(container);
  try {
    await act(async () => { ReactDOM.render(<ChakraProvider><AddEdit isOpen type="edit" selectedId="opportunity" onClose={() => {}} /></ChakraProvider>, container); });
    expect(document.querySelector('#relation-contact').value).toBe('Buyer Name');
    expect(document.querySelector('#opportunity-account').value).toBe('Partner Company');
    expect(document.querySelector('#opportunity-assigned-user').value).toBe('Assigned Agent');
    expect(document.body.textContent).toContain('Garden Villa');
    for (const id of Object.values(ids)) expect(document.body.textContent).not.toContain(id);
  } finally {
    act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.clear();
  }
});
