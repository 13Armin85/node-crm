/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act */
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ChakraProvider } from '@chakra-ui/react';
import { LanguageProvider } from 'i18n';
import TableTools, { readColumnPreferences, useVisibleColumns } from './TableTools';

let container;
const storageKey='crm-table-columns:reviewer:Contacts';
const columns=[{id:'name',label:'Name'},{id:'email',label:'Email'},{id:'phone',label:'Phone'}];
function Example({items=columns,moduleName='Contacts'}) {
  const {visible,order,columns:shown,setVisible}=useVisibleColumns(items,moduleName);
  return <><TableTools columns={items} visible={visible} order={order} onColumnsChange={setVisible}/><output>{shown.map(column=>column.id).join(',')}</output></>;
}
const render=(items=columns,moduleName='Contacts')=>act(async()=>{ReactDOM.render(<ChakraProvider><LanguageProvider><Example items={items} moduleName={moduleName}/></LanguageProvider></ChakraProvider>,container);});
const button=text=>[...document.querySelectorAll('button')].find(element=>element.textContent.trim()===text);
const open=async()=>{await act(async()=>{Simulate.click(document.querySelector('button[aria-label="Table tools"]'));});await act(async()=>{Simulate.click(button('Manage Columns'));});};
beforeEach(()=>{localStorage.clear();localStorage.setItem('user',JSON.stringify({_id:'reviewer',role:'admin'}));container=document.createElement('div');document.body.appendChild(container);});
afterEach(()=>{act(()=>{ReactDOM.unmountComponentAtNode(container);});container.remove();localStorage.clear();});
test('ordering and hidden columns persist together, including after a new input is added',async()=>{
  await render();await open();
  await act(async()=>{Simulate.click(document.querySelector('button[aria-label="Move up: Phone"]'));});
  await act(async()=>{Simulate.click(document.querySelector('button[aria-label="Move up: Phone"]'));});
  await act(async()=>{Simulate.change(document.querySelector('[data-column-id="email"] input'),{target:{checked:false}});});
  await act(async()=>{Simulate.click(button('Save'));});
  expect(container.querySelector('output').textContent).toBe('phone,name');
  expect(JSON.parse(localStorage.getItem(storageKey))).toEqual({hidden:['email'],order:['phone','name','email']});
  act(()=>{ReactDOM.unmountComponentAtNode(container);});await render([...columns,{id:'reference',label:'Reference'}]);
  expect(container.querySelector('output').textContent).toBe('phone,name,reference');
  await render(columns,'Opportunities');expect(container.querySelector('output').textContent).toBe('name,email,phone');
});
test('existing hidden-column preferences are retained and malformed preferences are ignored',async()=>{
  localStorage.setItem(storageKey,JSON.stringify(['email']));await render();
  expect(container.querySelector('output').textContent).toBe('name,phone');
  localStorage.setItem('broken','null');expect(readColumnPreferences('broken')).toEqual({hidden:[],order:[]});
  localStorage.setItem('broken','{');expect(readColumnPreferences('broken')).toEqual({hidden:[],order:[]});
});
test('canceling a rearrangement leaves the saved order unchanged',async()=>{
  await render();await open();await act(async()=>{Simulate.click(document.querySelector('button[aria-label="Move down: Name"]'));});
  await act(async()=>{Simulate.click(button('Cancel'));});
  expect(container.querySelector('output').textContent).toBe('name,email,phone');expect(localStorage.getItem(storageKey)).toBeNull();
});
