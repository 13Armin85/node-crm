import { useEffect, useState } from 'react';
import { getApi } from 'services/api';
import { useLanguage } from 'i18n';
import { formLabel, formValue } from 'utils/formValue';

export const isRecordId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const modules = {
  assignUser: 'Users', assignedBy: 'Users', createBy: 'Users', modifiedBy: 'Users', propertyAgent: 'Users',
  assignedToUser: 'Users', delegatedBy: 'Users', salesAgent: 'Users', sender: 'Users',
  assignedTo: 'Users', residence: 'Residences', assignTo: 'Contacts', assignToLead: 'Leads',
  contact: 'Contacts', linkContact: 'Contacts', propertyOwner: 'Contacts', relatedContacts: 'Contacts',
  lead: 'Leads', linkLead: 'Leads', relatedLeads: 'Leads',
  associatedListing: 'Properties', property: 'Properties', properties: 'Properties', relatedProperties: 'Properties', interestProperty: 'Properties', linkProperty: 'Properties',
  partnerCustomer: 'Partner Customers', partnerCustomers: 'Partner Customers', accountName: 'Partner Customers',
  relatedOpportunities: 'Opportunities', opportunities: 'Opportunities', linkOpportunity: 'Opportunities', quotes: 'Quotes',
};
export const relationModule = (name, field = {}) => {
  const moduleName = field.relation || field.relationModule || field.ref || modules[name];
  return ({ User: 'Users', Contact: 'Contacts', Lead: 'Leads', Property: 'Properties', Opportunity: 'Opportunities', PartnerCustomers: 'Partner Customers' })[moduleName] || moduleName;
};

function Reference({ id, moduleName }) {
  const { t } = useLanguage();
  const [label, setLabel] = useState('');
  useEffect(() => {
    let active = true;
    setLabel('');
    if (!moduleName) return undefined;
    getApi(`api/estate/${encodeURIComponent(moduleName)}/options?id=${encodeURIComponent(id)}`)
      .then(result => { if (active && result?.status === 200) setLabel(formLabel(result.data?.[0]?.label)); })
      .catch(() => {});
    return () => { active = false; };
  }, [id, moduleName]);
  return <span data-no-translate>{label && !isRecordId(label) ? label : t('Record unavailable')}</span>;
}

// Display labels while retaining IDs in form values and stored relationships.
export default function RecordValue({ value, name, field, moduleName }) {
  const { t, language } = useLanguage();
  const relation = moduleName || relationModule(name, field);
  if (value === null || value === undefined || value === '') return <>—</>;
  if (Array.isArray(value)) return <>{value.map((item, index) => <span key={index}>
    {index > 0 && ', '}<RecordValue value={item} name={name} field={field} moduleName={relation} />
  </span>)}</>;
  if (typeof value === 'object') {
    if (value[language] || value.en) return <>{t(value[language] || value.en)}</>;
    if (value.label && typeof value.label === 'object') return <RecordValue value={value.label} />;
    const label = formLabel(value);
    if (label && !isRecordId(label)) return <span data-no-translate>{t(label)}</span>;
    const id = formValue(value);
    if (isRecordId(id)) return <Reference id={id} moduleName={relation} />;
    return <>{Object.entries(value).filter(([key]) => !['_id', 'id', '__v', '_duplicateKeys'].includes(key)).map(([key, item], index) =>
      <span key={key}>{index > 0 && ', '}{t(key)}: <RecordValue name={key} value={item} /></span>)}</>;
  }
  if (isRecordId(value)) return <Reference id={value} moduleName={relation} />;
  return <>{t(String(value))}</>;
}
