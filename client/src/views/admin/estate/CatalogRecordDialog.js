import React, { useState } from 'react';
import { Alert, AlertIcon, Button, FormControl, FormLabel, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Spinner } from '@chakra-ui/react';
import { useFormik, setIn } from 'formik';
import DynamicFormRenderer, { fieldPath } from 'components/dynamicForm/DynamicFormRenderer';
import FormFeedback from 'components/dynamicForm/FormFeedback';
import { useFormDefinition, validateFormValues, normalizeFormValues } from 'utils/managedForm';
import { useLanguage } from 'i18n';
import { postApi } from 'services/api';

export default function CatalogRecordDialog({ moduleName, onClose, onCreated }) {
  const { t } = useLanguage();
  const district = moduleName === 'Districts';
  const { definition, definitionError } = useFormDefinition(moduleName, !district);
  const [error, setError] = useState('');
  let initialValues = district ? { name: '' } : {};
  for (const field of definition?.fields || []) if (field.defaultValue !== undefined) initialValues = setIn(initialValues, fieldPath(field), field.defaultValue);
  const formik = useFormik({ initialValues, enableReinitialize: true,
    validate: values => district ? (values.name?.trim() ? {} : { name: 'required' }) : validateFormValues(definition, values),
    async onSubmit(values, helpers) {
      setError('');
      try {
        const response = await postApi(`api/estate/${district ? 'districts' : 'Residences'}`, district ? { name: values.name.trim() } : normalizeFormValues(definition, values));
        const result = response?.response || response;
        if (result?.status === 201) { onCreated(result.data); onClose(); }
        else { setError(result?.data?.code || 'serverError'); if (result?.data?.field) helpers.setFieldError(result.data.field, result.data.code); }
      } catch { setError('serverError'); }
    },
  });
  return <Modal isOpen onClose={formik.isSubmitting ? () => {} : onClose} size={district ? 'md' : '5xl'} scrollBehavior="inside">
    <ModalOverlay /><ModalContent className="crm-record-form crm-catalog-dialog">
      <ModalHeader>{t(district ? 'Create New District' : 'Create New Residence')}</ModalHeader><ModalCloseButton isDisabled={formik.isSubmitting} />
      <ModalBody>
        <FormFeedback formik={formik} />
        {(error || definitionError) && <Alert status="error"><AlertIcon />{t(`estate.${error || 'serverError'}`)}</Alert>}
        {district ? <FormControl isRequired><FormLabel htmlFor="new-district-name">{t('District')}</FormLabel><Input id="new-district-name" name="name" value={formik.values.name} onChange={formik.handleChange} maxLength={200} autoFocus /></FormControl>
          : definition ? <DynamicFormRenderer definition={definition} formik={formik} idPrefix="catalog-field" /> : <Spinner />}
      </ModalBody>
      <ModalFooter gap={2}><Button variant="outline" onClick={onClose} isDisabled={formik.isSubmitting}>{t('Cancel')}</Button><Button variant="brand" onClick={formik.handleSubmit} isLoading={formik.isSubmitting} isDisabled={!district && !definition}>{t('Save and Select')}</Button></ModalFooter>
    </ModalContent>
  </Modal>;
}
