/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Exercises the actual menu using ReactDOM. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationsMenu from './NotificationsMenu';
import useNotifications from './useNotifications';
jest.mock('./useNotifications');
jest.mock('i18n', () => ({ useLanguage: () => ({ t: text => text, language: 'en', direction: 'ltr' }) }));
let container;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); });
const render = count => {
  useNotifications.mockReturnValue({ notifications: [], unreadCount: count, refresh: jest.fn() });
  act(() => { ReactDOM.render(<ChakraProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><NotificationsMenu userId="test" /></MemoryRouter></ChakraProvider>, container); });
};
test('enables the bell dot only while notifications are unread, including after clearing the inbox', () => {
  render(0);
  expect(container.querySelector('.crm-header-icon-button').dataset.unread).toBe('false');
  expect(container.querySelector('.crm-header-icon-button').getAttribute('aria-label')).toBe('Notifications');
  render(2);
  expect(container.querySelector('.crm-header-icon-button').dataset.unread).toBe('true');
  expect(container.querySelector('.crm-header-icon-button').getAttribute('aria-label')).toBe('Notifications: 2 unread');
  expect(container.querySelector('.crm-notifications-count')).toBeNull();
  render(0);
  expect(container.querySelector('.crm-header-icon-button').dataset.unread).toBe('false');
});
