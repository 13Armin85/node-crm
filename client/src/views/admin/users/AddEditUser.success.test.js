/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { getApi, putApi } from 'services/api';
import { toast } from 'react-toastify';
import AddEditUser from './AddEditUser';
jest.mock('services/api', () => ({ getApi: jest.fn(), putApi: jest.fn(), postApi: jest.fn() }));
jest.mock('react-redux', () => ({ useDispatch: () => jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
test('user edits show a stable success message and trigger only one list refresh', async () => {
  localStorage.setItem('user', JSON.stringify({ _id: 'admin', role: 'admin' }));
  getApi.mockResolvedValue({ status: 200, data: { moduleName: 'Users', fields: [] } });
  putApi.mockResolvedValue({ status: 200 });
  const onClose = jest.fn(), setAction = jest.fn(), fetchData = jest.fn();
  const container = document.createElement('div'); document.body.appendChild(container);
  try {
    await act(async () => { ReactDOM.render(<ChakraProvider><AddEditUser isOpen onClose={onClose} setAction={setAction} fetchData={fetchData}
      setUserAction={jest.fn()} selectedId="user" userAction="edit"
      data={{ _id: 'user', role: 'user', username: 'user@example.test', firstName: 'First' }} /></ChakraProvider>, container); });
    await act(async () => { Simulate.click(document.querySelector('.chakra-modal__footer button')); });
    expect(putApi).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(expect.any(String), { toastId: 'user-save', autoClose: 6000 });
    expect(onClose).toHaveBeenCalled();
    expect(setAction).toHaveBeenCalledTimes(1);
    expect(fetchData).not.toHaveBeenCalled();
  } finally { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); localStorage.clear(); }
});
