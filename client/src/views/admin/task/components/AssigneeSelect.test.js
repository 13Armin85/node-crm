/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercises native inputs using ReactDOM. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import AssigneeSelect from './AssigneeSelect';
jest.mock('i18n', () => ({ useLanguage: () => ({ t: text => text }) }));
let container;
const onChange = jest.fn();
const users = [
  { _id: 'fa', firstName: 'علی', lastName: 'کریمی' },
  { _id: 'tr', firstName: 'İpek', lastName: 'Yılmaz' },
  { _id: 'en', firstName: 'John', lastName: 'Smith' },
];
beforeEach(() => { onChange.mockClear(); container = document.createElement('div'); document.body.appendChild(container); });
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); });
const render = () => act(() => { ReactDOM.render(<ChakraProvider><AssigneeSelect assignees={users} value="en" onChange={onChange} /></ChakraProvider>, container); });
const search = text => act(() => Simulate.change(container.querySelector('input'), { target: { value: text } }));
test('searching preserves the assignee until explicitly changed', () => {
  render(); search('IPEK YILMAZ');
  expect([...container.querySelectorAll('option')].map(node => node.value)).toEqual(['', 'en', 'tr']);
  expect(container.querySelector('select').value).toBe('en');
  expect(onChange).not.toHaveBeenCalled();
  search('علي كريمي');
  expect([...container.querySelectorAll('option')].map(node => node.value)).toEqual(['', 'en', 'fa']);
  act(() => Simulate.change(container.querySelector('select'), { target: { value: 'fa' } }));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(container.querySelector('input').value).toBe('');
  expect(container.querySelectorAll('option')).toHaveLength(4);
});
test('a missing result keeps selection and clearing restores all users', () => {
  render(); search('nobody');
  expect(container.querySelector('[role="status"]').textContent).toBe('No Data Found');
  expect(container.querySelector('select').value).toBe('en');
  search('');
  expect(container.querySelector('[role="status"]')).toBeNull();
  expect(container.querySelectorAll('option')).toHaveLength(4);
});
