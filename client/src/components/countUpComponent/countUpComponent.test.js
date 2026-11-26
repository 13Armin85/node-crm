/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act */
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import CountUpComponent from './countUpComponent';

let container, callback, frames;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); frames = 0;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(next => { callback = next; return ++frames; });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  window.matchMedia = jest.fn(() => ({ matches: false }));
});
afterEach(async () => { await act(async () => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); jest.restoreAllMocks(); delete window.matchMedia; });
const render = value => act(() => { ReactDOM.render(<CountUpComponent targetNumber={value} />, container); });

test('large counters finish in a fixed time and leave no repeating animation', () => {
  const start = performance.now();
  render(5000000);
  act(() => { callback(start + 600); });
  expect(container.textContent).toBe('5000000');
  expect(frames).toBe(1);
});

test('touch devices and reduced-motion preferences show final values without scheduling frames', () => {
  window.matchMedia.mockReturnValue({ matches: true });
  render(5000000);
  expect(container.textContent).toBe('5000000');
  expect(frames).toBe(0);
});

test('changing a target cancels its previous animation', () => {
  render(10); render(20);
  expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
  act(() => { ReactDOM.unmountComponentAtNode(container); });
  expect(window.cancelAnimationFrame).toHaveBeenCalledWith(2);
});
