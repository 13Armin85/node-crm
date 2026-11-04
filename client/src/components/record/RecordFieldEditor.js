import React, { useEffect, useRef, useState } from 'react';
import { Alert, AlertIcon, Box, Button } from '@chakra-ui/react';
import { useFormik } from 'formik';
import { FiCheck, FiX } from 'react-icons/fi';
import { useLanguage } from 'i18n';
import DynamicFormRenderer from 'components/dynamicForm/DynamicFormRenderer';
import { validateFormValues } from 'utils/managedForm';
import { changedRecordValues, editableDefinition, recordFormValues } from './recordEditing';

export default function RecordFieldEditor({ field, editing, onClose }) {
  const { t } = useLanguage(), [error, setError] = useState(''), [extra, setExtra] = useState([]);
  const mounted = useRef(true), element = useRef(null);
  useEffect(() => {
    element.current?.querySelector('input:not([type="hidden"]),textarea,select,[role="combobox"]')?.focus();
    return () => { mounted.current = false; };
  }, []);
  const definition = editableDefinition(editing.definition, editing.record);
  const names = new Set([field.name, ...extra]);
  const resets = { category: ['subtype', 'bedroom'], transactionType: ['sale.status', 'sale.buyerType', 'sale.lead', 'sale.partnerCustomer', 'sale.soldAt'], isInsideResidence: ['residence'], 'sale.status': ['sale.buyerType', 'sale.lead', 'sale.partnerCustomer', 'sale.soldAt'], 'sale.buyerType': ['sale.lead', 'sale.partnerCustomer'] };
  if (['Properties', 'Residences'].includes(editing.moduleName)) for (const name of resets[field.name] || []) names.add(name);
  // Changing a controlling value must also expose the fields it makes required.
  for (const candidate of definition.fields) if (Object.keys(candidate.condition || {}).some(key => names.has(key))) names.add(candidate.name);
  const fields = definition.fields.filter(candidate => names.has(candidate.name));
  const initialValues = recordFormValues(definition, editing.record);
  const formik = useFormik({ initialValues,
    validate: values => validateFormValues({ ...definition, moduleName: undefined, fields }, values),
    async onSubmit(values, helpers) {
      setError('');
      const changes = changedRecordValues(definition, values, initialValues);
      if (!Object.keys(changes).length) { onClose(); return; }
      try {
        const result = await editing.save(changes);
        if (!mounted.current) return;
        if (result?.status === 200) onClose();
        else {
          setError(result?.data?.code || 'serverError');
          if (result?.data?.field) { setExtra(current => [...new Set([...current, result.data.field])]); helpers.setFieldError(result.data.field, result.data.code || 'invalid'); }
        }
      } catch { if (mounted.current) setError('serverError'); }
    },
  });
  return <Box ref={element} className="crm-field-editor" onDoubleClick={event => event.stopPropagation()} onKeyDown={event => {
    if (event.key === 'Escape' && !event.defaultPrevented) { event.stopPropagation(); event.preventDefault(); if (!formik.isSubmitting) onClose(); }
    if (event.key === 'Enter' && !event.defaultPrevented && event.target.tagName === 'INPUT' && event.target.getAttribute('role') !== 'combobox' && !['checkbox', 'radio', 'file'].includes(event.target.type) && !event.nativeEvent.isComposing) { event.preventDefault(); formik.handleSubmit(); }
  }}>
    {error && <Alert status="error"><AlertIcon />{t(`estate.${error}`)}</Alert>}
    <DynamicFormRenderer definition={{ ...definition, fields }} formik={formik} idPrefix="inline-field" />
    <div className="crm-field-editor-actions"><Button size="sm" variant="brand" leftIcon={<FiCheck />} onClick={formik.handleSubmit} isLoading={formik.isSubmitting}>{t('Save')}</Button><Button size="sm" variant="outline" leftIcon={<FiX />} onClick={onClose} isDisabled={formik.isSubmitting}>{t('Cancel')}</Button></div>
  </Box>;
}
