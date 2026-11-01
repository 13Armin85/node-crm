import { formLabel, formValue } from './formValue';

export const leadOwnerName = lead => {
  const owner = lead.assignUser || lead.createBy;
  return owner && typeof owner === 'object' ? formLabel(owner, '') : '';
};
export const leadPropertyName = lead => typeof lead.associatedListing === 'object' ? formLabel(lead.associatedListing, '') : '';
export const leadPhone = lead => lead.leadMobile || lead.leadPhoneNumber || '';
export const leadTransactionType = lead => {
  const value = formValue(lead.listedFor || lead.transactionType || lead.customFields?.transactionType);
  const type = String(value || '').trim().toUpperCase();
  return ['BUY', 'SALE', 'FOR SALE'].includes(type) ? 'SALE' : ['RENT', 'FOR RENT'].includes(type) ? 'RENT' : value;
};
export const leadCreationDate = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString() : '-';
