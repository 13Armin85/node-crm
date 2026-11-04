import React, { useMemo } from 'react';
import { Link } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { getIn } from 'formik';
import { useLanguage } from 'i18n';
import { useFormDefinition } from 'utils/managedForm';
import { fieldPath, localized, FileInput } from 'components/dynamicForm/DynamicFormRenderer';
import RecordValue, { relationModule, isRecordId } from 'components/relations/RecordValue';
import CurrencyAmount from 'components/CurrencyAmount';
import { formValue, formLabel } from 'utils/formValue';
import { getApi } from 'services/api';
import { recordValue } from 'utils/exportRecords';

const protectedFields = new Set(['_id','__v','password','authVersion','avatarFilename','avatarVersion','deleted','_duplicateKeys','customFields']);
const contactStageFields = new Set(['state', 'leadState', 'leadStage']);
export const tableFields = (definition, moduleName = definition?.moduleName) => [...(definition?.fields || [])].filter(field => field.enabled !== false && !protectedFields.has(field.name)
  && !(moduleName === 'Contacts' && contactStageFields.has(field.name))).sort((a,b)=>(a.order||0)-(b.order||0));
export const tableFieldValue = (record,field) => getIn(record,fieldPath(field)) ?? getIn(record,field.name);
const paths = { Contacts:'/contactView/', Leads:'/leadView/', Users:'/userView/', Properties:'/propertyView/', Opportunities:'/opportunitiesView/', 'Partner Customers':'/partner-customers/', Invoices:'/invoicesView/', Tasks:'/view/', Meetings:'/metting/', Calls:'/phone-call/', Emails:'/Email/' };
const primaryNames = { Contacts:'fullName', Leads:'leadName', Opportunities:'opportunityName', Properties:'title', Residences:'name', 'Partner Customers':'fullName', Users:'firstName' };
export function TableFieldValue({ field, value, record = {}, moduleName }) {
  const {t,language}=useLanguage();
  if(value == null || value === '' || (Array.isArray(value)&&!value.length)) return <>{field.name==='leadStage'?t('finance.unknownStage'):'—'}</>;
  if(field.name==='probability') return <span data-no-translate>{Number(value)}%</span>;
  const relation=relationModule(field.name,field);
  const render = item => {
    const option=field.options?.find(option=>String(option.value)===String(formValue(item)));
    let content=option && !relation ? localized(option.label,language) : <RecordValue value={item} name={field.name} field={field} />;
    const target=relation && isRecordId(formValue(item)) ? paths[relation]+encodeURIComponent(formValue(item))
      : primaryNames[moduleName]===field.name && record._id && paths[moduleName] ? paths[moduleName]+encodeURIComponent(record._id) : null;
    if(target && !target.startsWith('undefined')) content=<Link as={RouterLink} to={target} color="brand.600" data-no-translate>{content}</Link>;
    return content;
  };
  if(field.type==='file' && Array.isArray(value)) return <FileInput value={value} disabled />;
  if(field.type==='currency') return <CurrencyAmount amount={value} currency={getIn(record,field.name.endsWith('.amount')?field.name.replace(/\.amount$/,'.currency'):'currency')||'TRY'} compact />;
  if(field.type==='checkbox') return <>{t(value?'Yes':'No')}</>;
  if(['date','datetime','datetime-local'].includes(field.type) && Number.isFinite(Date.parse(value))) return <>{new Date(value).toLocaleString(({fa:'fa-IR',tr:'tr-TR'})[language]||'en-US',field.type==='date'?{dateStyle:'medium'}:{dateStyle:'medium',timeStyle:'short'})}</>;
  return <span style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{Array.isArray(value)?value.map((item,index)=><React.Fragment key={index}>{index>0?', ':''}{render(item)}</React.Fragment>):render(value)}</span>;
}
const aliases={contactName:'contact',leadName:'lead',assignUserName:'assignUser',assignToName:'assignTo',assignedToUserName:'assignedToUser',propertyNames:'properties',propertyName:'property',accountName2:'accountName'};
export function mergeFormColumns(base,definition,moduleName,language) {
  if(!definition) return base;
  const fields=tableFields(definition,moduleName), used=new Set(), removed=new Set(definition.removedFields||[]);
  const columns=base.flatMap(column=>{
    const name=typeof column.accessor==='string'?column.accessor:column.id;
    if(moduleName==='Contacts'&&contactStageFields.has(name))return[];
    if(!name || ['_id','action','actions','transferToOpportunity'].includes(name))return[column];
    const matchName = moduleName==='Leads'&&name==='leadName'?'leadName':aliases[name]||name;
    const field=fields.find(field=>fieldPath(field)===matchName||field.name===matchName);
    if(!field) return removed.has(name)||definition.fields.some(field=>field.name===matchName&&field.enabled===false)?[]:[column];
    const id=fieldPath(field); if(used.has(id))return[]; used.add(id);
    const generated=field.kind==='CUSTOM_FIELD'||field.relation||field.name==='probability'||primaryNames[moduleName]===field.name||['currency','date','datetime'].includes(field.type)||field.options?.length;
    return [{...column,id,accessor:row=>tableFieldValue(row,field),Header:localized(field.label,language)||column.Header,field,
      ...(generated?{cell:({row})=><TableFieldValue field={field} value={tableFieldValue(row.original,field)} record={row.original} moduleName={moduleName} />}:{}),exportValue:column.exportValue}];
  });
  const extra=fields.filter(field=>!used.has(fieldPath(field))).map(field=>({id:fieldPath(field),accessor:row=>tableFieldValue(row,field),Header:localized(field.label,language)||field.name,field,isSortable:true,cell:({row})=><TableFieldValue field={field} value={tableFieldValue(row.original,field)} record={row.original} moduleName={moduleName} />}));
  const at=columns.findIndex(column=>['action','actions','transferToOpportunity'].includes(column.accessor||column.id));
  return at<0?[...columns,...extra]:[...columns.slice(0,at),...extra,...columns.slice(at)];
}
export function useFormTableColumns(moduleName,columns) {
  const {language}=useLanguage(), {definition}=useFormDefinition(moduleName,Boolean(moduleName));
  return useMemo(()=>mergeFormColumns(columns,definition,moduleName,language),[columns,definition,moduleName,language]);
}

// Resolve references through the same permission-scoped labels used by the table.
export async function prepareTableExport(columns,records,t,language) {
  const references=new Map(),labels=new Map();
  for(const column of columns) {
    if(!column.field)continue;
    const moduleName=relationModule(column.field.name,column.field);
    if(!moduleName)continue;
    for(const record of records) {
      const value=recordValue(record,column.accessor);
      for(const item of Array.isArray(value)?value:[value]) {
        const id=formValue(item);
        if(isRecordId(id))references.set(moduleName+'/'+id,{moduleName,id});
      }
    }
  }
  const jobs=[...references.entries()];
  await Promise.all(Array.from({length:Math.min(6,jobs.length)},async()=>{
    while(jobs.length) {
      const [key,{moduleName,id}]=jobs.shift();
      try {const result=await getApi(`api/estate/${encodeURIComponent(moduleName)}/options?id=${encodeURIComponent(id)}`);if(result?.status===200)labels.set(key,formLabel(result.data?.[0]?.label));}catch{ /* Hidden or unavailable relations keep their display placeholder. */ }
    }
  }));
  return columns.map(column=>{
    if(!column.field)return column;
    const field=column.field,moduleName=relationModule(field.name,field);
    const format=value=>{
      if(value==null||value==='')return '';
      if(Array.isArray(value))return value.map(format).join(', ');
      if(typeof value==='boolean')return t(value?'Yes':'No');
      const id=formValue(value);
      if(isRecordId(id))return labels.get(moduleName+'/'+id)||t('Record unavailable');
      const option=field.options?.find(item=>String(item.value)===String(id));
      if(option&&!moduleName)return localized(option.label,language);
      if(typeof value==='object')return formLabel(value)||'';
      return value;
    };
    return {...column,format};
  });
}
