/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Verifies the controlled pager and boundary behavior. */
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import RecordPagination from './RecordPagination';
let container;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); });
function Harness({ total = 43 }) {
  const [page, setPage] = useState(1), [size, setSize] = useState(5);
  return <RecordPagination page={page} pageCount={Math.ceil(total / size)} total={total} pageSize={size}
    onPageChange={setPage} onPageSizeChange={value => { setSize(value); setPage(1); }} />;
}
const render = element => act(() => { ReactDOM.render(<ChakraProvider>{element}</ChakraProvider>, container); });
const button = label => container.querySelector(`button[aria-label="${label}"]`);
const click = label => act(() => Simulate.click(button(label)));
test('numbered pages, last-page boundaries and record ranges stay consistent', () => {
  render(<Harness />);
  expect(button('Previous Page').disabled).toBe(true);
  expect(container.querySelector('[aria-current="page"]').textContent).toBe('1');
  click('Page 3');
  expect(container.querySelector('.crm-record-pagination__range').textContent).toBe('11–15 / 43 records');
  click('Last Page');
  expect(container.querySelector('[aria-current="page"]').textContent).toBe('9');
  expect(container.querySelector('.crm-record-pagination__range').textContent).toBe('41–43 / 43 records');
  expect(button('Next Page').disabled).toBe(true);
});
test('page size resets the page and direct entry clamps invalid or empty page numbers', () => {
  render(<Harness />);
  click('Page 2');
  act(() => Simulate.change(container.querySelector('select'), { target: { value: '10' } }));
  expect(container.querySelector('[aria-current="page"]').textContent).toBe('1');
  const jump = container.querySelector('input');
  act(() => Simulate.change(jump, { target: { value: '999' } }));
  act(() => Simulate.keyDown(jump, { key: 'Enter', preventDefault: jest.fn() }));
  expect(container.querySelector('[aria-current="page"]').textContent).toBe('5');
  act(() => Simulate.change(jump, { target: { value: '' } }));
  act(() => Simulate.blur(jump));
  expect(jump.value).toBe('5');
  act(() => Simulate.change(jump, { target: { value: '-4' } }));
  act(() => Simulate.blur(jump));
  expect(container.querySelector('[aria-current="page"]').textContent).toBe('1');
});
test('one-page and empty results keep navigation disabled and never show negative ranges', () => {
  render(<Harness total={0} />);
  expect(button('Previous Page').disabled).toBe(true);
  expect(button('Next Page').disabled).toBe(true);
  expect(container.querySelector('.crm-record-pagination__range').textContent).toBe('0–0 / 0 records');
});
