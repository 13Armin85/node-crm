/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercises filter values through the rebuilt form. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import AdvanceSearch from './advanceSearch';
let container;
const fields = [{ name: 'name', label: 'Name', type: 'text' }, { name: 'status', label: 'Status', type: 'select', options: [{ value: 'open', label: 'Open' }] }, { name: 'createdDate', label: 'Created Date', type: 'date' }];
beforeEach(() => { localStorage.setItem('crm-language', 'en'); container = document.createElement('div'); document.body.appendChild(container); });
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.clear(); });
const render = props => act(() => { ReactDOM.render(<ChakraProvider><AdvanceSearch advaceSearch tableCustomFields={fields} setAdvaceSearch={jest.fn()} {...props} /></ChakraProvider>, container); });
const change = async (selector, value) => act(async () => { const node = document.querySelector(selector); Simulate.change(node, { target: { name: node.name, value } }); });
test('date filters start collapsed and retain their values when collapsed before applying', async () => {
  const submit = jest.fn(); render({ handleAdvanceSearch: submit });
  const toggle = document.querySelector('.crm-filter-dates__toggle');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(document.querySelector('#crm-filter-date-fields').hidden).toBe(true);
  await act(async () => { Simulate.click(toggle); });
  await change('input[name="name"]', 'Mobile');
  await change('select[name="status"]', 'open');
  await change('input[name="fromcreatedDate"]', '2026-10-19');
  await act(async () => { Simulate.click(toggle); });
  expect(document.querySelector('#crm-filter-date-fields').hidden).toBe(true);
  expect(document.querySelector('.crm-filter-dates__count').textContent).toBe('1');
  await act(async () => { Simulate.submit(document.querySelector('.crm-advanced-search')); });
  expect(submit).toHaveBeenCalledWith({ name: 'Mobile', status: 'open', fromcreatedDate: '2026-10-19', tocreatedDate: '' });
});
test('clear resets text, options and hidden date values, and reopening starts compact', async () => {
  render({ handleAdvanceSearch: jest.fn() });
  await change('input[name="name"]', 'Mobile');
  await change('input[name="fromcreatedDate"]', '2026-10-19');
  await act(async () => { Simulate.click(document.querySelector('.chakra-modal__footer button:last-child')); });
  expect(document.querySelector('input[name="name"]').value).toBe('');
  expect(document.querySelector('input[name="fromcreatedDate"]').value).toBe('');
  expect(document.querySelector('.crm-filter-dates__count')).toBeNull();
});
