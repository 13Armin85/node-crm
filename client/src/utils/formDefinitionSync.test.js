/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act */
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { getApi } from 'services/api';
import { useFormDefinition } from './managedForm';
import { announceFormDefinition, FORM_DEFINITION_STORAGE_KEY } from 'services/formDefinitionEvents';
jest.mock('services/api', () => ({ getApi: jest.fn() }));
let container;
const definition = (revision, enabled) => ({ moduleName: 'Tasks', revision, fields: [{ name: 'notes', enabled }] });
function View() {
  const result = useFormDefinition('Tasks');
  return <div>{JSON.stringify(result)}</div>;
}
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); jest.clearAllMocks(); localStorage.clear(); });
test('a confirmed save refreshes an open form and an older pending fetch cannot restore removed fields', async () => {
  let resolveLoad;
  getApi.mockImplementationOnce(() => new Promise(resolve => { resolveLoad = resolve; }));
  await act(async () => ReactDOM.render(<View />, container));
  await act(async () => announceFormDefinition(definition(2, false)));
  await act(async () => resolveLoad({ status: 200, data: definition(1, true) }));
  expect(JSON.parse(container.textContent).definition).toEqual(definition(2, false));
});
test('other-tab saves and focus refresh the matching form definition', async () => {
  getApi.mockResolvedValue({ status: 200, data: definition(1, true) });
  await act(async () => ReactDOM.render(<View />, container));
  getApi.mockResolvedValue({ status: 200, data: definition(2, false) });
  await act(async () => window.dispatchEvent(new StorageEvent('storage', { key: FORM_DEFINITION_STORAGE_KEY, newValue: JSON.stringify({ moduleName: 'Tasks' }) })));
  expect(JSON.parse(container.textContent).definition).toEqual(definition(2, false));
  const calls = getApi.mock.calls.length;
  await act(async () => window.dispatchEvent(new StorageEvent('storage', { key: FORM_DEFINITION_STORAGE_KEY, newValue: JSON.stringify({ moduleName: 'Contacts' }) })));
  expect(getApi).toHaveBeenCalledTimes(calls);
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(getApi).toHaveBeenCalledTimes(calls + 1);
});
