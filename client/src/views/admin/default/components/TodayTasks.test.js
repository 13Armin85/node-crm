/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercises the rendered dashboard box. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';
import TodayTasks from './TodayTasks';
import { getApi } from 'services/api';

jest.mock('services/api', () => ({ getApi: jest.fn() }));
jest.mock('i18n', () => ({ useLanguage: () => ({ t: value => value, language: 'en' }) }));
jest.mock('assets/css/TaskAgenda.css', () => ({}));

const day = offset => { const date = new Date(); date.setDate(date.getDate() + offset); return date.toISOString().slice(0, 10); };
const tasks = [
  { _id: '1', title: 'My call', start: day(0) + ' 09:00', status: 'todo', assignedToUser: 'me', assignedToUserName: 'Me User' },
  { _id: '2', title: 'Colleague visit', start: day(0) + ' 11:00', status: 'todo', assignedToUser: 'other', assignedToUserName: 'Other Person' },
  { _id: '3', title: 'Finished today', start: day(0), status: 'completed', assignedToUser: 'me' },
  { _id: '4', title: 'Late item', start: day(-2), status: 'todo', assignedToUser: 'me' },
  { _id: '5', title: 'Tomorrow item', start: day(1), status: 'todo', assignedToUser: 'me' },
];
let container;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); getApi.mockResolvedValue({ status: 200, data: tasks }); });
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); });
const render = async props => { await act(async () => { ReactDOM.render(<ChakraProvider><MemoryRouter><TodayTasks {...props} /></MemoryRouter></ChakraProvider>, container); }); };
const titles = () => [...container.querySelectorAll('.crm-today-tasks__task')].map(item => item.textContent);

test('ordinary users see only their own open tasks for today', async () => {
  await render({ user: { _id: 'me' }, isAdmin: false });
  expect(titles()).toEqual(['My call']);
  expect(container.textContent).toContain('taskAgenda.todayMine');
  expect(container.querySelector('.crm-today-tasks__overdue').textContent).toContain('1');
  expect(container.querySelector('.crm-today-tasks__avatar')).toBeNull();
});

test('administrators see everyone\'s open tasks for today with the assignee', async () => {
  await render({ user: { _id: 'me' }, isAdmin: true });
  expect(titles()).toEqual(['My call', 'Colleague visit']);
  expect(container.textContent).toContain('taskAgenda.todayTeam');
  expect([...container.querySelectorAll('.crm-today-tasks__avatar')].map(item => item.textContent)).toEqual(['MU', 'OP']);
});
