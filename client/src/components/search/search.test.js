/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Verify the search input used by existing form record pickers. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import CustomSearchInput from './search';

test('record pickers search translated letters, nested values and numbers and reset pagination', () => {
  const container = document.createElement('div'); document.body.appendChild(container);
  const onSearch = jest.fn(), setSearchbox = jest.fn(), setGopageValue = jest.fn(), setDisplaySearchData = jest.fn();
  const records = [{ name: 'İpek Yılmaz', address: { city: 'Şişli' }, phone: 12345 }, { name: 'John Smith', address: { city: 'London' }, phone: 9 }];
  try {
    act(() => { ReactDOM.render(<ChakraProvider><CustomSearchInput allData={records}
      dataColumn={[{ accessor: 'name' }, { accessor: 'address.city' }, { accessor: 'phone' }]} searchbox=""
      onSearch={onSearch} setSearchbox={setSearchbox} setDisplaySearchData={setDisplaySearchData} setGopageValue={setGopageValue} /></ChakraProvider>, container); });
    act(() => Simulate.change(container.querySelector('input'), { target: { value: '  IPEK sisli ۱۲۳  ' } }));
    expect(onSearch).toHaveBeenLastCalledWith([records[0]]);
    expect(setSearchbox).toHaveBeenLastCalledWith('  IPEK sisli ۱۲۳  ');
    expect(setGopageValue).toHaveBeenLastCalledWith(1);
    act(() => Simulate.change(container.querySelector('input'), { target: { value: '' } }));
    expect(onSearch).toHaveBeenLastCalledWith(records);
    expect(setDisplaySearchData).toHaveBeenLastCalledWith(false);
  } finally { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); }
});
