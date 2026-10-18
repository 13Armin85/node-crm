/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act -- Verify native option labels and the actual Redux search result. */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { LanguageProvider, translate } from 'i18n';
import reducer from 'redux/slices/advanceSearchSlice';
import CallAdvanceSearch from 'views/admin/phoneCall/components/callAdvanceSearch';
import EmailAdvanceSearch from 'views/admin/emailHistory/components/EmailAdvanceSearch';

jest.mock('@chakra-ui/react', () => {
  const actual=jest.requireActual('@chakra-ui/react');
  const Box=({children})=><div>{children}</div>;
  return {...actual,Modal:({isOpen,children})=>isOpen?<div>{children}</div>:null,
    ModalContent:Box,ModalBody:Box,ModalHeader:Box,ModalFooter:Box,ModalOverlay:()=>null,ModalCloseButton:()=>null};
});
let container;
beforeEach(()=>{container=document.createElement('div');document.body.appendChild(container);});
afterEach(()=>{act(()=>{ReactDOM.unmountComponentAtNode(container);});container.remove();localStorage.clear();});
const rows=[
  {_id:'contact-activity',createBy:'staff-1',createByContact:'contact-1'},
  {_id:'lead-activity',createBy:'staff-1',createByLead:'lead-1'},
  {_id:'unrelated-activity',createBy:'staff-1'},
];

for(const [moduleName,Component] of [['Calls',CallAdvanceSearch],['Emails',EmailAdvanceSearch]]){
  test.each(['en','fa','tr'])(moduleName+' related filter has readable options and returns only the selected relationship (%s)',async language=>{
    localStorage.setItem('crm-language',language);
    const store=configureStore({reducer:{advanceSearchData:reducer}});
    await act(async()=>ReactDOM.render(<Provider store={store}><ChakraProvider><LanguageProvider>
      <Component advanceSearch allData={rows} setAdvanceSearch={jest.fn()} setDisplaySearchData={jest.fn()} setSearchbox={jest.fn()} />
    </LanguageProvider></ChakraProvider></Provider>,container));
    const select=container.querySelector('select[name="realetedTo"]');
    expect([...select.options].filter(option=>option.value).map(option=>option.textContent)).toEqual([translate('Contact',language),translate('Lead',language)]);
    expect(select.textContent).not.toMatch(/\[object/);
    for(const [value,id] of [['contact','contact-activity'],['lead','lead-activity']]){
      await act(async()=>Simulate.change(select,{target:{name:'realetedTo',value}}));
      const submit=[...container.querySelectorAll('button')].find(button=>button.textContent===translate('Search',language));
      await act(async()=>Simulate.click(submit));
      expect(store.getState().advanceSearchData.searchResult.map(row=>row._id)).toEqual([id]);
    }
  });
}
