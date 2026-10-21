/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Verifies browser viewport subscription and cleanup. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import ModalViewport from './ModalViewport';
let container, original, frame, raf, cancel;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container);
  original = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 42; });
  cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => {
  act(() => { ReactDOM.unmountComponentAtNode(container); });
  container.remove();
  if (original) Object.defineProperty(window, 'visualViewport', original); else delete window.visualViewport;
  jest.restoreAllMocks();
});
const render = () => act(() => { ReactDOM.render(<ModalViewport />, container); });
const value = name => document.documentElement.style.getPropertyValue('--crm-dialog-' + name);
test('dialog bounds follow keyboard height and visual viewport offsets with one animation frame', () => {
  const viewport = Object.assign(new EventTarget(), { width: 390, height: 844, offsetTop: 0, offsetLeft: 0 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  render();
  expect(value('height')).toBe('844px');
  Object.assign(viewport, { height: 350, offsetTop: 120, offsetLeft: 4 });
  act(() => { viewport.dispatchEvent(new Event('resize')); viewport.dispatchEvent(new Event('scroll')); });
  expect(raf).toHaveBeenCalledTimes(1);
  act(() => frame());
  expect(value('height')).toBe('350px');
  expect(value('top')).toBe('120px');
  expect(value('left')).toBe('4px');
  act(() => { ReactDOM.unmountComponentAtNode(container); });
  expect(value('height')).toBe('');
  viewport.dispatchEvent(new Event('resize'));
  expect(raf).toHaveBeenCalledTimes(1);
});
test('fallback bounds use the window and pending frames are cancelled on unmount', () => {
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
  render();
  expect(value('height')).toBe(`${window.innerHeight}px`);
  expect(value('width')).toBe(`${window.innerWidth}px`);
  act(() => { window.dispatchEvent(new Event('resize')); });
  act(() => { ReactDOM.unmountComponentAtNode(container); });
  expect(cancel).toHaveBeenCalledWith(42);
});
