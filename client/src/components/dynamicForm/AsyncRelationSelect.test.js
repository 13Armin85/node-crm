/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercise the relation picker across debounced and out-of-order API replies. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { LanguageProvider } from 'i18n';
import { AsyncRelationSelect } from './DynamicFormRenderer';
import { getApi } from 'services/api';
jest.mock('services/api', () => ({ getApi: jest.fn(), postApi: jest.fn() }));
let container;
beforeEach(() => { jest.useFakeTimers(); container = document.createElement('div'); document.body.appendChild(container); getApi.mockReset(); });
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); jest.useRealTimers(); });
const render = props => act(async () => ReactDOM.render(<ChakraProvider><LanguageProvider><AsyncRelationSelect id="contact" name="contact" moduleName="Contacts" onChange={jest.fn()} {...props} /></LanguageProvider></ChakraProvider>, container));
const tick = () => act(async () => { jest.advanceTimersByTime(300); });
const open = () => act(async () => Simulate.focus(container.querySelector('input')));
const search = query => act(async () => Simulate.change(container.querySelector('input'), { target: { value: query } }));
test('only the latest search reply populates the options; selected records survive a search with no matches', async () => {
  let resolveOld;
  getApi.mockImplementation(path => path.includes('id=') ? Promise.resolve({ status: 200, data: [{ value: 'selected', label: 'Selected contact' }] })
    : path.endsWith('q=old') ? new Promise(resolve => { resolveOld = resolve; })
      : Promise.resolve({ status: 200, data: path.endsWith('q=new') ? [{ value: 'new', label: 'New contact' }] : [] }));
  await render({ value: 'selected' }); await open(); await tick();
  await search('old'); await tick(); await search('new'); await tick();
  await act(async () => resolveOld({ status: 200, data: [{ value: 'old', label: 'Old contact' }] }));
  expect([...document.querySelectorAll('[role=option]')].map(option => option.textContent)).toEqual(['Selected contact', 'New contact']);
  await search('missing'); await tick();
  expect(document.querySelector('[role=option][aria-selected=true]')?.textContent).toBe('Selected contact');
  expect(document.querySelector('[role="status"]').textContent).toContain('No Data Found');
});
test('failed requests leave the picker usable for the next query', async () => {
  getApi.mockRejectedValueOnce(new Error('offline'));
  await render(); await open(); await tick();
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
  getApi.mockResolvedValue({ status: 200, data: [{ value: '1', label: 'Found' }] });
  await search('Found'); await tick();
  expect(document.querySelector('[role="alert"]')).toBeNull();
  expect(document.querySelector('[role=option]').textContent).toBe('Found');
});

test('one editable input supports search, selection and clearing without a separate select', async () => {
  const onChange = jest.fn();
  getApi.mockResolvedValue({ status: 200, data: [{ value: '1', label: 'Contact One' }] });
  await render({ onChange }); await open(); await tick();
  expect(container.querySelectorAll('input')).toHaveLength(1);
  expect(container.querySelector('select')).toBeNull();
  await act(async () => Simulate.keyDown(container.querySelector('input'), { key: 'Enter' }));
  expect(onChange).toHaveBeenCalledWith('1');
});
