/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import ConvertLeadButtons from './ConvertLeadButtons';
import ConvertedLeadDetails from 'components/relations/ConvertedLeadDetails';
import { postApi } from 'services/api';
import { HasAccess } from '../../../../redux/accessUtils';

jest.mock('services/api', () => ({ postApi: jest.fn() }));
jest.mock('../../../../redux/accessUtils', () => ({ HasAccess: jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
let container;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container);
  HasAccess.mockReturnValue([{ update: true, delete: true }, { create: true }, { create: true }]);
  postApi.mockReset();
});
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); });
const render = element => act(() => { ReactDOM.render(<ChakraProvider>{element}</ChakraProvider>, container); });

test.each(['contact', 'contactAndOpportunity'])('icon-only button submits %s and refreshes after success', async mode => {
  const onConverted = jest.fn();
  postApi.mockResolvedValue({ status: 200, data: { contactId: 'contact' } });
  render(<ConvertLeadButtons leadId="lead" onConverted={onConverted} />);
  const buttons = container.querySelectorAll('button');
  expect(buttons).toHaveLength(2);
  expect(buttons[0].textContent).toBe('');
  expect(buttons[1].textContent).toBe('');
  expect(buttons[0].getAttribute('aria-label')).toBeTruthy();
  await act(async () => { Simulate.click(buttons[mode === 'contact' ? 0 : 1]); });
  expect(postApi).toHaveBeenCalledWith('api/lead/convert/lead', { mode });
  expect(onConverted).toHaveBeenCalledWith({ contactId: 'contact' });
});
test('failed transfer retains current lead and enables retry', async () => {
  const onConverted = jest.fn();
  postApi.mockResolvedValue({ status: 409, data: { code: 'duplicate' } });
  render(<ConvertLeadButtons leadId="lead" onConverted={onConverted} />);
  await act(async () => { Simulate.click(container.querySelector('button')); });
  expect(onConverted).not.toHaveBeenCalled();
  expect(container.querySelector('button').disabled).toBe(false);
});
test('destination permissions control available conversion buttons', () => {
  HasAccess.mockReturnValue([{ update: true, delete: true }, { create: true }, {}]);
  render(<ConvertLeadButtons leadId="lead" />);
  expect(container.querySelectorAll('button')).toHaveLength(1);
  HasAccess.mockReturnValue([{ update: true }, { create: true }, { create: true }]);
  render(<ConvertLeadButtons leadId="lead" />);
  expect(container.querySelectorAll('button')).toHaveLength(0);
});
test('source details display both initial values and custom zero/false values', () => {
  render(<ConvertedLeadDetails records={[{ leadId: 'lead', values: { leadName: 'Original Name', customFields: { budget: 0, enabled: false } },
    fields: [{ name: 'budget', label: 'Budget' }] }]} />);
  expect(container.textContent).toContain('Original Name');
  expect(container.textContent).toContain('Budget');
  expect(container.textContent).toContain('0');
  expect(container.textContent).toContain('false');
});
