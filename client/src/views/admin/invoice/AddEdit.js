import React, { useEffect, useMemo, useState } from 'react';
import { AddIcon, CloseIcon } from '@chakra-ui/icons';
import { Box, Button, Checkbox, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, DrawerOverlay,
  FormControl, FormErrorMessage, FormLabel, Grid, GridItem, Heading, IconButton, Input, Select, Spinner,
  Table, Tbody, Td, Text, Textarea, Th, Thead, Tr } from '@chakra-ui/react';
import { getIn, useFormik } from 'formik';
import ManagedFormLayout from 'components/dynamicForm/ManagedFormLayout';
import { AsyncRelationSelect } from 'components/dynamicForm/DynamicFormRenderer';
import CalendarDateInput from 'components/date/CalendarDateInput';
import { tr, withLocalization } from 'i18n/runtime';
import { isAdmin } from 'roles';
import { HasAccess } from '../../../redux/accessUtils';
import { getApi, postApi, putApi } from 'services/api';
import { formValue } from 'utils/formValue';
import { calculateInvoice } from 'utils/invoiceCalculations';
import { invoicesSchema } from 'schema/invoicesSchema';
import { toast } from 'react-toastify';
import InvoiceDocument, { invoiceMoney } from './components/InvoiceDocument';

const addressKeys = ['Street', 'City', 'State', 'PostalCode', 'Country'];
const blankItem = () => ({ productName: '', qty: 0, rate: 0, discount: 0, discountType: 'none' });
const initialInvoice = (invoice = {}, contactId) => ({
  customFields: invoice.customFields || {}, title: invoice.title || '',
  property: formValue(invoice.property), transactionType: invoice.transactionType || '',
  quoteNumber: invoice.quoteNumber || '', quoteDate: invoice.quoteDate?.slice(0, 10) || '',
  invoiceDate: invoice.invoiceDate?.slice(0, 10) || '', dueDate: invoice.dueDate?.slice(0, 10) || '',
  status: formValue(invoice.status) || 'Draft', assignedTo: formValue(invoice.assignedTo),
  account: formValue(invoice.account), contact: formValue(invoice.contact || contactId),
  description: invoice.description || '', isCheck: Boolean(invoice.isCheck),
  currency: invoice.currency === '$' ? 'USD' : invoice.currency || 'TRY',
  items: invoice.items || [], shipping: invoice.shipping ?? 0, ptax: invoice.ptax ?? 20,
  ...Object.fromEntries(['billing', 'shipping'].flatMap(prefix => addressKeys.map(key =>
    [prefix + key, invoice[prefix + key] || (key === 'Country' ? 'Türkiye' : '')]))),
  ...calculateInvoice(invoice),
});
function AddEdit({ isOpen, onClose, type, selectedId, contactId, setAction, action }) {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const [accountAccess, contactAccess] = HasAccess(['Partner Customers', 'Contacts']);
  const [loaded, setLoaded] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [preview, setPreview] = useState(false);
  const [property, setProperty] = useState(null);
  useEffect(() => {
    let active = true;
    setPreview(false); setLoaded(null); setLoadError(false);
    if (!isOpen || type !== 'edit') { setLoading(false); return undefined; }
    setLoading(true);
    getApi('api/invoices/view/', selectedId).then(result => {
      if (!active) return;
      if (result?.status === 200 && result.data?.result) setLoaded(result.data.result);
      else setLoadError(true);
    }).catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, type, selectedId, action]);
  const initialValues = useMemo(() => initialInvoice(loaded || {}, contactId), [loaded, contactId]);
  const formik = useFormik({
    initialValues, enableReinitialize: true, validationSchema: invoicesSchema,
    onSubmit: async values => {
      const totals = calculateInvoice(values);
      const payload = { ...values, ...totals, ...Object.fromEntries(['property', 'account', 'contact', 'assignedTo'].map(key => [key, values[key] || null])), modifiedBy: user?._id, ...(type === 'add' ? { createBy: user?._id } : {}) };
      if (values.isCheck) addressKeys.forEach(key => { payload['shipping' + key] = values['billing' + key]; });
      try {
        const result = type === 'edit' ? await putApi(`api/invoices/edit/${selectedId}`, payload) : await postApi('api/invoices/add', payload);
        if (result?.status === 200) {
          toast.success(tr(type === 'edit' ? 'Invoice Update successfully' : 'Invoice Save successfully'));
          setAction?.(previous => !previous); close();
        } else {
          if (result?.data?.field) formik.setFieldError(result.data.field, tr(`estate.${result.data.code || 'invalid'}`));
          toast.error(tr(`estate.${result?.data?.code || 'serverError'}`));
        }
      } catch (_) { toast.error(tr('estate.serverError')); }
    },
  });
  const { values, setFieldValue } = formik;
  const totals = useMemo(() => calculateInvoice(values), [values]);
  const close = () => { formik.resetForm(); setPreview(false); onClose(); };
  useEffect(() => {
    let active = true; setProperty(null);
    if (!values.property) return undefined;
    getApi(`api/estate/Properties/${values.property}`).then(result => {
      if (!active || result?.status !== 200) return;
      setProperty(result.data);
      if (!values.transactionType && result.data.transactionType) setFieldValue('transactionType', result.data.transactionType);
    }).catch(() => {});
    return () => { active = false; };
  }, [values.property, values.transactionType, setFieldValue]);
  const document = { ...values, ...totals, invoiceNumber: loaded?.invoiceNumber,
    propertyName: property?.title || property?.name || loaded?.propertyName };
  if (values.isCheck) addressKeys.forEach(key => { document['shipping' + key] = values['billing' + key]; });
  const fieldError = name => (formik.submitCount > 0 || getIn(formik.touched, name)) && getIn(formik.errors, name);
  const field = (name, label, control, span = 6) => <GridItem key={name} colSpan={{ base: 12, md: span }}>
    <FormControl isInvalid={Boolean(fieldError(name))}>
      <FormLabel htmlFor={`invoice-${name}`}>{tr(label)}</FormLabel>{control}
      <FormErrorMessage>{fieldError(name)}</FormErrorMessage>
    </FormControl>
  </GridItem>;
  const input = (name, label, options = {}) => {
    const common = { id: `invoice-${name}`, name, value: document[name] ?? '',
      onBlur: formik.handleBlur, onChange: formik.handleChange, ...options };
    return field(name, label, <Input {...common} />);
  };
  const relation = (name, label, moduleName) => field(name, label,
    <AsyncRelationSelect id={`invoice-${name}`} name={name} moduleName={moduleName} value={values[name]}
      onBlur={formik.handleBlur} onChange={value => {
        setFieldValue(name, value || null);
        if (name === 'property') setFieldValue('transactionType', '');
      }} />);
  const select = (name, label, options) => field(name, label,
    <Select id={`invoice-${name}`} name={name} value={values[name]} onChange={formik.handleChange} onBlur={formik.handleBlur}>
      {options.map(([value, text]) => <option key={value} value={value}>{tr(text)}</option>)}
    </Select>);
  const section = label => <GridItem colSpan={12}><Heading size="sm" className="crm-invoice-section">{tr(label)}</Heading></GridItem>;
  const updateItem = (index, key, value) => setFieldValue('items', values.items.map((item, position) =>
    position === index ? { ...item, [key]: value } : item));
  const cell = (item, index, key, label, numeric = false) => {
    const name = `items[${index}].${key}`;
    return <FormControl isInvalid={Boolean(fieldError(name))}><Input size="sm" name={name}
      aria-label={`${tr(label)} ${index + 1}`} type={numeric ? 'number' : 'text'} min={numeric ? 0 : undefined}
      step={numeric ? 'any' : undefined} value={item[key] ?? ''} onBlur={formik.handleBlur}
      isDisabled={key === 'discount' && item.discountType === 'none'}
      onChange={event => updateItem(index, key, event.target.value)} />
      <FormErrorMessage>{fieldError(name)}</FormErrorMessage></FormControl>;
  };
  return <Drawer isOpen={isOpen} onClose={close} size="xl">
    <DrawerOverlay /><DrawerContent className="crm-invoice-form">
      <DrawerHeader display="flex" alignItems="center" justifyContent="space-between">
        <Text>{tr(preview ? 'Preview' : type === 'edit' ? 'Edit' : 'Add')} {tr('Invoice')}</Text>
        <IconButton aria-label={tr('Close')} icon={<CloseIcon />} onClick={close} variant="ghost" />
      </DrawerHeader>
      <DrawerBody>{loading ? <Box textAlign="center" py={12}><Spinner /></Box>
        : loadError ? <Text color="red.500">{tr('estate.serverError')}</Text>
        : preview ? <InvoiceDocument invoice={document} />
        : <ManagedFormLayout moduleName="Invoices" formik={formik}>
          <Grid templateColumns="repeat(12, minmax(0, 1fr))" gap={5}>
            {section('Overview')}
            {input('title', 'Title')}
            {input('quoteNumber', 'Quote Number')}
            {relation('property', 'Property', 'Properties')}
            {select('transactionType', 'Transaction Type', [['', 'Select'], ['SALE', 'Purchased'], ['RENT', 'Rented']])}
            {['invoiceDate', 'dueDate', 'quoteDate'].map(name => field(name, ({ invoiceDate: 'Invoice Date', dueDate: 'Due Date', quoteDate: 'Quote Date' })[name],
              <CalendarDateInput id={`invoice-${name}`} name={name} type="date" value={values[name]}
                onBlur={formik.handleBlur} onChange={formik.handleChange} />))}
            {select('status', 'Status', ['Draft', 'Sent', 'Pending', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'].map(value => [value, value]))}
            {isAdmin(user) && relation('assignedTo', 'Assigned To', 'Users')}
            {(isAdmin(user) || accountAccess?.view) && relation('account', 'Partner Customer', 'Partner Customers')}
            {(isAdmin(user) || contactAccess?.view) && relation('contact', 'Contact', 'Contacts')}
            {field('description', 'Description', <Textarea id="invoice-description" name="description" value={values.description}
              onChange={formik.handleChange} onBlur={formik.handleBlur} resize="vertical" />, 12)}
            {section('Address Information')}
            <GridItem colSpan={12}><Checkbox name="isCheck" isChecked={values.isCheck}
              onChange={event => setFieldValue('isCheck', event.target.checked)}>{tr('Copy address from left')}</Checkbox></GridItem>
            {addressKeys.map(key => ['billing', 'shipping'].map(prefix =>
              input(prefix + key, `${prefix === 'billing' ? 'Billing' : 'Shipping'} ${key === 'PostalCode' ? 'Postal Code' : key}`,
                { isDisabled: prefix === 'shipping' && values.isCheck,
                  ...(key === 'PostalCode' ? { inputMode: 'numeric', maxLength: 5 } : {}) })))}
            {section('Line Items')}
            {select('currency', 'Currency', [['TRY', 'TRY — Turkish Lira (₺)'], ['USD', 'USD — US Dollar ($)'], ['EUR', 'EUR — Euro (€)']])}
            <GridItem colSpan={12}><Box overflowX="auto"><Table size="sm" className="crm-invoice-items">
              <Thead><Tr>{['#', 'Item', 'Qty', 'Rate', 'Discount', 'Amount', ''].map((label, index) => <Th key={index}>{tr(label)}</Th>)}</Tr></Thead>
              <Tbody>{values.items.map((item, index) => <Tr key={index}>
                <Td>{index + 1}</Td><Td>{cell(item, index, 'productName', 'Item')}</Td>
                <Td>{cell(item, index, 'qty', 'Qty', true)}</Td><Td>{cell(item, index, 'rate', 'Rate', true)}</Td>
                <Td><Box display="grid" gap={1}>{cell(item, index, 'discount', 'Discount', true)}
                  <Select size="sm" aria-label={`${tr('Discount Type')} ${index + 1}`} value={totals.items[index].discountType}
                    onChange={event => updateItem(index, 'discountType', event.target.value)}>
                    <option value="none">{tr('No Discount')}</option><option value="percent">{tr('Percentage')} (%)</option>
                    <option value="flatAmount">{tr('Fixed Amount')} ({values.currency})</option>
                  </Select></Box></Td>
                <Td data-no-translate>{invoiceMoney(totals.items[index].amount, values.currency)}</Td>
                <Td><IconButton size="sm" colorScheme="red" variant="ghost" aria-label={`${tr('Delete')} ${index + 1}`}
                  icon={<CloseIcon />} onClick={() => setFieldValue('items', values.items.filter((_, position) => position !== index))} /></Td>
              </Tr>)}</Tbody>
            </Table></Box><Button mt={3} size="sm" variant="outline" leftIcon={<AddIcon />}
              onClick={() => setFieldValue('items', [...values.items, blankItem()])}>{tr('Add')}</Button></GridItem>
            {input('total', 'Total', { value: totals.total.toFixed(2), isReadOnly: true })}
            {input('discount', 'Total Discount', { value: totals.discount.toFixed(2), isReadOnly: true })}
            {input('subtotal', 'Subtotal', { value: totals.subtotal.toFixed(2), isReadOnly: true })}
            {input('shipping', 'Shipping', { type: 'number', min: 0, step: '0.01', value: values.shipping })}
            {input('shippingTax', 'KDV Matrahı', { value: totals.shippingTax.toFixed(2), isReadOnly: true })}
            {select('ptax', 'KDV (%)', [...new Set(['0', '1', '10', '20', String(values.ptax)])].map(rate => [rate, `%${rate}`]))}
            {input('tax', 'KDV', { value: totals.tax.toFixed(2), isReadOnly: true })}
            {input('grandTotal', 'Grand Total', { value: totals.grandTotal.toFixed(2), isReadOnly: true })}
          </Grid>
        </ManagedFormLayout>}</DrawerBody>
      <DrawerFooter gap={2} flexWrap="wrap">
        <Button size="sm" variant="outline" isDisabled={loading || loadError} onClick={() => setPreview(!preview)}>{tr(preview ? 'Hide' : 'Preview')}</Button>
        {!preview && <Button size="sm" variant="brand" isLoading={formik.isSubmitting} isDisabled={loading || loadError}
          onClick={formik.handleSubmit}>{tr('Save')}</Button>}
        <Button size="sm" variant="outline" onClick={close}>{tr('Close')}</Button>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>;
}
export default withLocalization(AddEdit);
