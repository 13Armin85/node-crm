/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- These tests use ReactDOM directly. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { labelOf, PropertyMultiSelect } from './RelationFields';

test('contact labels use full name and support legacy first and last names', () => {
  expect(labelOf({ fullName: 'علی رضایی', email: 'ali@example.com' }, 'contact')).toBe('علی رضایی');
  expect(labelOf({ firstName: 'Ali', lastName: 'Rezaei', email: 'ali@example.com' }, 'contact')).toBe('Ali Rezaei');
});

test('property search keeps selections and lets users select without modifier keys', () => {
  const container = document.createElement('div');
  const setFieldValue = jest.fn();
  act(() => { ReactDOM.render(<PropertyMultiSelect items={[
    { _id: 'one', title: 'Villa 2', district: 'North' },
    { _id: 'two', title: 'Apartment 1', district: 'South' },
  ]} value={['one']} setFieldValue={setFieldValue} />, container); });
  expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(2);
  act(() => { const input = container.querySelector('#related-property-search'); input.value = 'south'; Simulate.change(input); });
  const choices = container.querySelectorAll('input[type="checkbox"]');
  expect(choices.length).toBe(1);
  expect(container.textContent).toContain('Villa 2');
  act(() => Simulate.change(choices[0], { target: { checked: true } }));
  expect(setFieldValue).toHaveBeenLastCalledWith('properties', ['one', 'two']);
  act(() => { ReactDOM.unmountComponentAtNode(container); });
});
