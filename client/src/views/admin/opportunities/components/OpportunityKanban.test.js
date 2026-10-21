/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import OpportunityKanban from './OpportunityKanban';
let mockDragEnd;
jest.mock('react-beautiful-dnd', () => ({
  DragDropContext: ({ children, onDragEnd }) => { mockDragEnd = onDragEnd; return children; },
  Droppable: ({ children }) => children({ innerRef: () => {}, droppableProps: {}, placeholder: null }, { isDraggingOver: false }),
  Draggable: ({ children }) => children({ innerRef: () => {}, draggableProps: {}, dragHandleProps: {} }, { isDragging: false }),
}));
let container;
const stages = [{ value: 'Open', label: 'Open' }, { value: 'Custom stage', label: 'Custom stage' }];
const records = [{ _id: 'one', opportunityName: 'Deal One', salesStage: 'Open' }, { _id: 'two', opportunityName: 'Deal Two', salesStage: 'Custom stage' },
  { _id: 'three', opportunityName: 'Legacy Deal', salesStage: '' }];
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); });
const render = props => act(() => { ReactDOM.render(<ChakraProvider><OpportunityKanban records={records} stages={stages} canMove={() => true} onView={jest.fn()} {...props} /></ChakraProvider>, container); });
test('columns exactly match the configured stage options, with no additional column for incomplete old records', () => {
  render();
  const columns = [...container.querySelectorAll('[data-stage]')];
  expect(columns.map(column => column.dataset.stage)).toEqual(stages.map(stage => stage.value));
  expect(columns[0].textContent).toContain('Deal One');
  expect(columns[1].textContent).toContain('Deal Two');
  expect(container.textContent).toContain('Legacy Deal');
});
test('dragging and accessible stage selection request the selected sales stage', () => {
  const change = jest.fn(); render({ onStageChange: change });
  act(() => { mockDragEnd({ draggableId: 'one', source: { droppableId: 'Open' }, destination: { droppableId: 'Custom stage' } }); });
  expect(change).toHaveBeenCalledWith('one', 'Custom stage');
  act(() => { Simulate.change(container.querySelector('select'), { target: { value: 'Custom stage' } }); });
  expect(change).toHaveBeenCalledTimes(2);
  act(() => { mockDragEnd({ draggableId: 'one', source: { droppableId: 'Open' }, destination: null }); });
  expect(change).toHaveBeenCalledTimes(2);
});
test('read-only opportunities cannot change stage', () => {
  render({ canMove: () => false });
  expect([...container.querySelectorAll('select')].every(select => select.disabled)).toBe(true);
});

test('shows contact, account, assignee, a zero value and only a valid close date, and opens the selected deal', () => {
  const view = jest.fn();
  render({ onView: view, records: [{ ...records[0], contactName: 'Jordan Lee', accountName2: 'North Estate',
    assignUserName: 'Alex Morgan', opportunityAmount: '0', currency: 'USD', expectedCloseDate: '2026-11-15' }] });
  const card = container.querySelector('.crm-opportunity-card');
  expect(card.textContent).toContain('Jordan Lee');
  expect(card.textContent).toContain('North Estate');
  expect(card.textContent).toContain('Alex Morgan');
  expect(card.querySelector('.crm-opportunity-card__amount').textContent).toContain('$0.00');
  expect(card.textContent).toContain('Nov 15, 2026');
  act(() => { Simulate.click(card.querySelector('button')); });
  expect(view).toHaveBeenCalledWith('one');
  render({ records: [{ ...records[0], opportunityAmount: 'invalid', expectedCloseDate: 'invalid' }] });
  expect(container.querySelector('.crm-opportunity-card__amount')).toBeNull();
  expect(container.textContent).not.toMatch(/NaN|Invalid Date/);
});

test('empty configured stages remain available and saving disables only that opportunity', () => {
  render({ records: [records[0]], savingId: 'one' });
  expect(container.querySelector('[data-stage="Custom stage"] .crm-opportunity-column__empty')).not.toBeNull();
  expect(container.querySelector('select').disabled).toBe(true);
  expect(container.querySelector('.crm-opportunity-card').getAttribute('aria-busy')).toBe('true');
});
