export const categories = [
  { value: 'GENERAL', label: 'General' },
  { value: 'PROPERTIES', label: 'Properties', entityType: 'Property' },
  { value: 'LEADS', label: 'Leads', entityType: 'Lead' },
  { value: 'OPPORTUNITIES', label: 'Opportunities', entityType: 'Opportunity' },
  { value: 'PARTNER_CUSTOMERS', label: 'Partner Customers', entityType: 'PartnerCustomer' },
  { value: 'CONTACTS', label: 'Contacts', entityType: 'Contact' },
  { value: 'INVOICES', label: 'Invoices' },
  { value: 'QUOTES', label: 'Quotes' },
  { value: 'TASKS', label: 'Tasks' },
  { value: 'MEETINGS', label: 'Meetings' },
  { value: 'CALLS', label: 'Calls' },
  { value: 'EMAILS', label: 'Emails' },
];

export const categoryOf = file => file.category
  || categories.find(category => category.entityType && category.entityType === file.entityType)?.value
  || 'GENERAL';
