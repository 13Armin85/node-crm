/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercises the rendered agenda controls. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import TaskAgenda from './TaskAgenda';

jest.mock('i18n', () => ({ useLanguage: () => ({ t: value => value, language: 'en' }) }));
jest.mock('assets/css/TaskAgenda.css', () => ({}));

const day = offset => { const date = new Date(); date.setDate(date.getDate() + offset); return date.toISOString().slice(0, 10); };
const me = { _id: 'me', role: 'user' };
const tasks = [
  { _id: 'own', title: 'Own call', start: day(0) + ' 10:30', status: 'todo', assignedToUser: 'me', createBy: 'me', assignedToUserName: 'Me User', assignToName: 'Client A' },
  { _id: 'given', title: 'Delegated visit', start: day(1), status: 'todo', assignedToUser: 'me', createBy: 'admin', assignedToUserName: 'Me User' },
  { _id: 'other', title: 'Other person task', start: day(0), status: 'todo', assignedToUser: 'someone', createBy: 'admin', assignedToUserName: 'Some One' },
];
let container;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); localStorage.setItem('user', JSON.stringify(me)); });
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.clear(); });
const render = props => act(() => { ReactDOM.render(<ChakraProvider><TaskAgenda tasks={tasks} user={me} {...props} /></ChakraProvider>, container); });
const row = title => [...container.querySelectorAll('.crm-agenda-row')].find(item => item.textContent.includes(title));

test('rows open details, own tasks can be ticked, delegated tasks stay read-only', async () => {
  const onOpen = jest.fn(), onStatusChange = jest.fn(async () => {});
  render({ onOpen, onStatusChange });
  expect(container.textContent).not.toContain('Other person task'); // "My tasks" is the default view
  Simulate.click(row('Own call').querySelector('.crm-agenda-row__main'));
  expect(onOpen).toHaveBeenCalledWith('own');
  await act(async () => { Simulate.change(row('Own call').querySelector('input')); });
  // The tick shows immediately; the task moves to Done only after a short pause.
  expect(row('Own call').querySelector('input').checked).toBe(true);
  expect(row('Own call').classList.contains('is-completing')).toBe(true);
  expect(onStatusChange).not.toHaveBeenCalled();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 750)); });
  expect(onStatusChange).toHaveBeenCalledWith('own', 'completed');
  expect(row('Delegated visit').querySelector('input').disabled).toBe(true);
  expect(row('Own call').querySelector('.crm-agenda-row__avatar').textContent).toBe('MU');
});

test('the All view adds other tasks and group headers collapse their rows', () => {
  render({ onOpen: jest.fn(), onStatusChange: jest.fn() });
  const allButton = [...container.querySelectorAll('.crm-agenda-segment')].find(item => item.textContent.startsWith('taskAgenda.all'));
  act(() => { Simulate.click(allButton); });
  expect(container.textContent).toContain('Other person task');
  const today = container.querySelector('[data-group="today"] .crm-agenda-group__header');
  expect(today.getAttribute('aria-expanded')).toBe('true');
  act(() => { Simulate.click(today); });
  expect(today.getAttribute('aria-expanded')).toBe('false');
  expect(container.querySelector('[data-group="today"] .crm-agenda-row')).toBeNull();
});

test('rows distinguish the contact from the assignee and expose important task details', () => {
  render({ tasks: [{ ...tasks[0], priority: 'urgent', status: 'inProgress', description: 'Confirm the appointment' }] });
  const item = row('Own call');
  expect(item.querySelector('.crm-agenda-row__related').textContent).toContain('Client A');
  expect(item.querySelector('.crm-agenda-row__assignee').textContent).toContain('Me User');
  expect(item.querySelector('.crm-agenda-row__description').textContent).toBe('Confirm the appointment');
  expect(item.querySelector('.crm-agenda-row__priority').textContent).toBe('taskAgenda.priority.urgent');
  expect(item.querySelector('.crm-agenda-row__status').textContent).toBe('taskAgenda.status.inProgress');
  expect(item.dataset.kind).toBe('call');
});

test('search finds contacts and assignees, combines filters, and reveals matches in closed groups', () => {
  render({ tasks: [
    { ...tasks[0], priority: 'urgent', status: 'inProgress', start: day(10) },
    { ...tasks[1], priority: 'normal' },
  ] });
  expect(row('Own call')).toBeUndefined(); // Later is initially collapsed.
  const search = container.querySelector('input[type="search"]');
  act(() => Simulate.change(search, { target: { value: 'client a' } }));
  expect(row('Own call')).toBeDefined();
  expect(row('Delegated visit')).toBeUndefined();
  act(() => Simulate.change(search, { target: { value: 'Me User' } }));
  expect(container.querySelectorAll('.crm-agenda-row')).toHaveLength(2);
  act(() => Simulate.change(container.querySelector('select[aria-label="Priority"]'), { target: { value: 'urgent' } }));
  expect(container.querySelectorAll('.crm-agenda-row')).toHaveLength(1);
  act(() => Simulate.change(container.querySelector('select[aria-label="Status"]'), { target: { value: 'completed' } }));
  expect(container.textContent).toContain('taskAgenda.noMatches');
  act(() => Simulate.click(container.querySelector('.crm-agenda__clear')));
  expect(container.querySelectorAll('.crm-agenda-row')).toHaveLength(2);
});
