/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercise the actual email forms and Formik submit lifecycle. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { LanguageProvider } from 'i18n';
import { getApi, postApi } from 'services/api';
import { toast } from 'react-toastify';
import AddEmail from './add';
import RelatedEmail from './components/AddEmail';
jest.mock('services/api', () => ({ getApi: jest.fn(), postApi: jest.fn() }));
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({ useDispatch: () => mockDispatch }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('components/commonTableModel/ContactModel', () => () => null);
jest.mock('components/commonTableModel/LeadModel', () => () => null);
jest.mock('components/commonTableModel/UserModel', () => () => null);
jest.mock('components/commonTableModel/MultiPropertyModel', () => () => null);
jest.mock('chakra-ui-autocomplete', () => ({ CUIAutoComplete: () => null }));
jest.mock('../newProperty/components/bookedStepperForm/FirstStepper', () => ({ FirstStepper: () => null }));
const contactId = '64d33173fd7ff3fa0924a102';
const leadId = '64d33173fd7ff3fa0924a103';
let container;
const save = () => document.querySelector('.chakra-modal__footer button');
const change = async (name, value) => act(async () => {
  const node = document.querySelector('[name="' + name + '"]');
  Simulate.change(node, { target: { name, value } });
});
const render = async (component) => act(async () => {
  ReactDOM.render(<ChakraProvider><LanguageProvider>{component}</LanguageProvider></ChakraProvider>, container);
});
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('crm-language', 'en');
  localStorage.setItem('user', JSON.stringify({ _id: '64d33173fd7ff3fa0924a101', role: 'admin' }));
  container = document.createElement('div'); document.body.appendChild(container);
  mockDispatch.mockResolvedValue({ payload: { status: 200, data: [{ _id: 'template', templateName: 'Template', html: '<p>Template body</p>' }] } });
  getApi.mockImplementation(async path => ({ status: 200, data: path.includes('/definitions/') ? { moduleName: 'Emails', fields: [] }
    : path.includes('/contact') ? [{ _id: contactId, fullName: 'Selected Contact', email: 'contact@example.test' }]
      : path.includes('/lead') ? [{ _id: leadId, leadName: 'Selected Lead', leadEmail: 'lead@example.test' }] : [] }));
  postApi.mockResolvedValue({ status: 200, data: { result: { deliveryStatus: 'SENT' } } });
});
afterEach(() => { act(() => ReactDOM.unmountComponentAtNode(container)); container.remove(); localStorage.clear(); });

test('the default contact picker loads and a valid message submits to that contact', async () => {
  const onClose = jest.fn();
  await render(<AddEmail isOpen onClose={onClose} setAction={jest.fn()} />);
  expect(document.querySelector('select[name="createByContact"]').textContent).toContain('Selected Contact');
  await change('createByContact', contactId);
  expect(document.querySelector('input[name="recipient"]').value).toBe('contact@example.test');
  await change('subject', 'Test subject'); await change('message', 'The written message');
  await act(async () => Simulate.click(save()));
  expect(postApi).toHaveBeenCalledWith('api/email/add', expect.objectContaining({ recipient: 'contact@example.test', subject: 'Test subject', message: 'The written message', createByContact: contactId, createByLead: '' }));
  expect(onClose).toHaveBeenCalledTimes(1); expect(toast.success).toHaveBeenCalled();
});

test('failed sending preserves the recipient and message and supports retrying the same form', async () => {
  postApi.mockResolvedValueOnce({ status: 502, data: { code: 'emailSendFailed' } });
  const onClose = jest.fn();
  await render(<AddEmail isOpen onClose={onClose} setAction={jest.fn()} />);
  await change('createByContact', contactId); await change('subject', 'Retained subject'); await change('message', 'Retained body');
  await act(async () => Simulate.click(save()));
  expect(onClose).not.toHaveBeenCalled(); expect(toast.success).not.toHaveBeenCalled(); expect(toast.error).toHaveBeenCalled();
  expect(document.querySelector('textarea[name="message"]').value).toBe('Retained body');
  expect(document.querySelector('input[name="subject"]').value).toBe('Retained subject');
  expect(document.querySelector('input[name="recipient"]').value).toBe('contact@example.test');
  await act(async () => Simulate.click(save()));
  expect(postApi).toHaveBeenCalledTimes(2); expect(onClose).toHaveBeenCalledTimes(1);
});

test('switching from a contact to a lead sends to the lead and clears the old recipient relation', async () => {
  await render(<AddEmail isOpen onClose={jest.fn()} setAction={jest.fn()} />);
  await change('createByContact', contactId);
  await act(async () => Simulate.change(document.querySelector('input[type="radio"][value="Lead"]'), { target: { value: 'Lead', checked: true } }));
  expect(document.querySelector('input[name="recipient"]').value).toBe('');
  await change('createByLead', leadId); await change('subject', 'Lead subject'); await change('message', 'Lead body');
  await act(async () => Simulate.click(save()));
  expect(postApi).toHaveBeenCalledWith('api/email/add', expect.objectContaining({ recipient: 'lead@example.test', createByContact: '', createByLead: leadId }));
});

test('the form remains populated and disabled until sending completes', async () => {
  let complete;
  postApi.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const onClose = jest.fn();
  await render(<AddEmail isOpen onClose={onClose} setAction={jest.fn()} />);
  await change('createByContact', contactId); await change('subject', 'Pending subject'); await change('message', 'Pending body');
  await act(async () => Simulate.click(save()));
  expect(save().disabled).toBe(true); expect(onClose).not.toHaveBeenCalled();
  expect(document.querySelector('textarea[name="message"]').value).toBe('Pending body');
  await act(async () => complete({ status: 200 }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test.each([false, true])('messages from an existing contact or lead submit successfully (lead: %s)', async lead => {
  const onClose = jest.fn(), fetchData = jest.fn();
  await render(<RelatedEmail isOpen onClose={onClose} fetchData={fetchData} lead={lead}
    id={lead ? leadId : contactId} contactEmail="contact@example.test" leadEmail="lead@example.test" />);
  await change('subject', 'Related subject'); await change('message', 'Related body');
  await act(async () => Simulate.click(save()));
  expect(postApi).toHaveBeenCalledWith('api/email/add', expect.objectContaining({ recipient: lead ? 'lead@example.test' : 'contact@example.test', message: 'Related body' }));
  expect(onClose).toHaveBeenCalledTimes(1); expect(fetchData).toHaveBeenCalledWith(1);
});

test.each([false, true])('switching compose modes retains both drafts and keeps template loading out of the send button (related: %s)', async related => {
  let complete;
  mockDispatch.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const props = { isOpen: true, onClose: jest.fn(), fetchData: jest.fn(), setAction: jest.fn(), id: contactId, contactEmail: 'contact@example.test' };
  await render(related ? <RelatedEmail {...props} /> : <AddEmail {...props} />);
  await change('subject', 'Keep my subject'); await change('message', 'Keep my written message');
  const switchType = async value => act(async () => Simulate.change(document.querySelector('input[type="radio"][value="' + value + '"]'), { target: { value, checked: true } }));
  await switchType('template');
  expect(document.querySelector('.crm-email-form .crm-email-content')).not.toBeNull();
  expect(document.querySelector('select[name="html"]').disabled).toBe(true);
  expect(save().disabled).toBe(true);
  expect(save().textContent).toBe('Save');
  expect(save().querySelector('.loader')).toBeNull();
  await switchType('message');
  expect(document.querySelector('textarea[name="message"]').value).toBe('Keep my written message');
  await switchType('template');
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  await act(async () => complete({ payload: { status: 200, data: [{ _id: 'template', templateName: 'My template', html: '<p>My draft</p>' }] } }));
  await change('html', '<p>My draft</p>');
  await switchType('message');
  expect(document.querySelector('textarea[name="message"]').value).toBe('Keep my written message');
  expect(document.querySelector('input[name="subject"]').value).toBe('Keep my subject');
  await switchType('template');
  expect(document.querySelector('select[name="html"]').value).toBe('<p>My draft</p>');
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(save().disabled).toBe(false);
});
