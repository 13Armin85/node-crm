import { configureStore } from '@reduxjs/toolkit';
import images, { fetchImage } from './imageSlice';
import route, { fetchRouteData } from './routeSlice';
import modules, { fetchModules } from './moduleSlice';
import { getApi } from 'services/api';
jest.mock('services/api', () => ({ getApi: jest.fn() }));
afterEach(() => jest.resetAllMocks());

test.each([
  ['images', images, fetchImage, 'images'],
  ['route', route, fetchRouteData, 'data'],
  ['modules', modules, fetchModules, 'data'],
])('%s keeps errors and malformed responses out of the record list and recovers on retry', async (name, reducer, fetchRecords, key) => {
  const store = configureStore({ reducer });
  for (const response of [{ status: 401, data: { message: 'Unauthorized' } }, { status: 200, data: { length: 1 } }, { status: 503, data: [] }, { status: 200, data: null }]) {
    getApi.mockResolvedValueOnce(response);
    const action = await store.dispatch(fetchRecords());
    expect(action.meta.requestStatus).toBe('rejected');
    expect(store.getState()[key]).toEqual([]);
  }
  const rows = [{ _id: 'record', moduleName: 'Example' }];
  getApi.mockResolvedValueOnce({ status: 200, data: rows });
  await store.dispatch(fetchRecords());
  expect(store.getState()[key]).toEqual(rows);
});
