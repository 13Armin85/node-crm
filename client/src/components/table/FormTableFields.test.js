/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act */
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from 'i18n';
import { mergeFormColumns, tableFieldValue, TableFieldValue, prepareTableExport } from './FormTableFields';
import { stageProbability, defaultStages } from 'utils/opportunityMetrics';
import { getApi } from 'services/api';
jest.mock('services/api',()=>({getApi:jest.fn()}));
const field=(name,extra={})=>({name,type:'text',label:{en:name},kind:'SYSTEM_FIELD',...extra});
test('all enabled form inputs become columns, including new custom and nested values',()=>{
  const fields=[field('fullName'),field('budget',{kind:'CUSTOM_FIELD',type:'number'}),field('sale.customerName'),field('removed',{enabled:false})];
  const base=[{accessor:'_id',Header:'#'},{accessor:'fullName',Header:'Old label'},{accessor:'removed'},{accessor:'action'}];
  const columns=mergeFormColumns(base,{fields},'Contacts','en');
  expect(columns.map(column=>column.id||column.accessor)).toEqual(['_id','fullName','customFields.budget','sale.customerName','action']);
  const row={fullName:'Alice',customFields:{budget:0},sale:{customerName:'Buyer'}};
  expect(columns[2].accessor(row)).toBe(0);expect(columns[3].accessor(row)).toBe('Buyer');
  expect(tableFieldValue({customFields:{checked:false}},field('checked',{kind:'CUSTOM_FIELD'}))).toBe(false);
  const updated=mergeFormColumns(base,{fields:[...fields,field('newInput',{kind:'CUSTOM_FIELD'})]},'Contacts','en');
  expect(updated.find(column=>column.id==='customFields.newInput')).toBeDefined();
});
test('contact name aliases use their actual related record and produce only one column',()=>{
  const columns=mergeFormColumns([{accessor:'contactName',Header:'Contact'}],{fields:[field('contact',{relation:'Contacts',type:'select'})]},'Opportunities','en');
  expect(columns).toHaveLength(1);expect(columns[0].accessor({contact:'contact-id',contactName:'Alice'})).toBe('contact-id');
});
test('lead stages are available in both contact and opportunity rows',()=>{
  const fields=[field('fullName'),field('state'),field('leadStage',{options:[{value:'Booked',label:{en:'Booked'}}]})];
  const contactColumns=mergeFormColumns([{accessor:'fullName'},{accessor:'state'},{accessor:'leadStage'}],{fields},'Contacts','en');
  expect(contactColumns.map(column=>column.id)).toEqual(['fullName','state','leadStage']);
  expect(contactColumns.find(column=>column.id==='state').accessor({state:'Waiting'})).toBe('Waiting');
  const hidden=mergeFormColumns([],{fields:[field('state',{enabled:false})]},'Contacts','en');
  expect(hidden).toHaveLength(0);
  const opportunityColumns=mergeFormColumns([],{fields:[field('opportunityName'),fields[2]]},'Opportunities','en');
  expect(opportunityColumns.find(column=>column.id==='leadStage').accessor({leadStage:'Booked'})).toBe('Booked');
});
test('contact names and references open their contact view while relation IDs remain hidden',async()=>{
  const id='6ad5cede20944f7bf63f495d';getApi.mockResolvedValue({status:200,data:[{label:'Alice'}]});
  const container=document.createElement('div');document.body.appendChild(container);
  try{
    await act(async()=>ReactDOM.render(<LanguageProvider><MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><TableFieldValue moduleName="Contacts" field={field('fullName')} record={{_id:id}} value="Alice"/><TableFieldValue field={field('contact',{relation:'Contacts'})} value={id}/></MemoryRouter></LanguageProvider>,container));
    expect([...container.querySelectorAll('a')].map(link=>link.getAttribute('href'))).toEqual(['/contactView/'+id,'/contactView/'+id]);
    expect(container.textContent).toBe('AliceAlice');expect(container.textContent).not.toContain(id);
  }finally{act(()=>{ReactDOM.unmountComponentAtNode(container);});container.remove();}
});
test('client probability reflects progression and terminal outcomes',()=>{
  const probabilities=defaultStages.slice(0,-2).map(stage=>stageProbability(stage));
  expect(probabilities.every((value,index)=>index===0||value>probabilities[index-1])).toBe(true);
  expect(stageProbability('Closed/Won')).toBe(100);expect(stageProbability('Closed/Lost')).toBe(0);
});
test('generated relation columns export names while preserving numeric zero and localized choices',async()=>{
  const id='6ad5cede20944f7bf63f495d';getApi.mockResolvedValue({status:200,data:[{label:'Alice'}]});
  const rows=[{contact:id,customFields:{budget:0},leadStage:'Booked'}];
  const columns=[{accessor:'contact',field:field('contact',{relation:'Contacts'})},{accessor:row=>row.customFields.budget,field:field('budget',{kind:'CUSTOM_FIELD'})},{accessor:'leadStage',field:field('leadStage',{options:[{value:'Booked',label:{fa:'رزروشده'}}]})}];
  const exported=await prepareTableExport(columns,rows,value=>value,'fa');
  expect(exported[0].format(id)).toBe('Alice');expect(exported[1].format(0)).toBe(0);expect(exported[2].format('Booked')).toBe('رزروشده');
});
