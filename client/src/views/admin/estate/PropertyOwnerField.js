import React, { useState } from 'react';
import { Alert, AlertIcon, Button, FormControl, FormErrorMessage, FormLabel, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Spinner, Stack } from '@chakra-ui/react';
import { useFormik, getIn, setIn } from 'formik';
import DynamicFormRenderer, { AsyncRelationSelect, fieldPath, localized } from 'components/dynamicForm/DynamicFormRenderer';
import { useFormDefinition, validateFormValues, normalizeFormValues } from 'utils/managedForm';
import { useLanguage } from 'i18n';
import { postApi } from 'services/api';

function NewOwnerDialog({ onClose, onCreated }) {
  const { t } = useLanguage();
  const { definition, definitionError } = useFormDefinition('Contacts');
  const [error, setError] = useState('');
  let initialValues = {};
  for (const field of definition?.fields || []) {
    if (field.defaultValue !== undefined) initialValues = setIn(initialValues, fieldPath(field), field.defaultValue);
  }
  const formik = useFormik({
    initialValues, enableReinitialize: true,
    validate: values => validateFormValues(definition, values),
    async onSubmit(values, helpers) {
      setError('');
      try {
        const response = await postApi('api/estate/Properties/owners', normalizeFormValues(definition, values));
        const result = response?.response || response;
        if (result?.status === 201) { onCreated(result.data); onClose(); }
        else {
          setError(result?.data?.code || 'serverError');
          if (result?.data?.field) helpers.setFieldError(result.data.field, result.data.code || 'invalid');
        }
      } catch { setError('serverError'); }
    },
  });
  return <Modal isOpen onClose={formik.isSubmitting ? () => {} : onClose} size="3xl" scrollBehavior="inside">
    <ModalOverlay /><ModalContent className="crm-record-form">
      <ModalHeader>{t('Create New Property Owner')}</ModalHeader><ModalCloseButton isDisabled={formik.isSubmitting} />
      <ModalBody>
        {(error || definitionError) && <Alert status="error"><AlertIcon />{t(`estate.${error || 'serverError'}`)}</Alert>}
        {definition ? <DynamicFormRenderer definition={definition} formik={formik} /> : <Spinner />}
      </ModalBody>
      <ModalFooter gap={2}>
        <Button variant="outline" onClick={onClose} isDisabled={formik.isSubmitting}>{t('Cancel')}</Button>
        <Button variant="brand" onClick={formik.handleSubmit} isLoading={formik.isSubmitting} isDisabled={!definition}>{t('Save Contact and Select')}</Button>
      </ModalFooter>
    </ModalContent>
  </Modal>;
}

export default function PropertyOwnerField({ field, formik, readOnly }) {
  const { t, language } = useLanguage();
  const [creating, setCreating] = useState(false);
  const path = fieldPath(field), error = getIn(formik.errors, path);
  return <FormControl isRequired={field.required} isInvalid={Boolean(error)}>
    <FormLabel htmlFor="field-propertyOwner">{localized(field.label, language)}</FormLabel>
    <Stack>
      <AsyncRelationSelect id="field-propertyOwner" name={path} moduleName="Contacts" value={getIn(formik.values, path)}
        onChange={value => formik.setFieldValue(path, value || null)} onBlur={formik.handleBlur} disabled={readOnly} />
      {!readOnly && <Button alignSelf="start" size="sm" variant="outline" onClick={() => setCreating(true)}>{t('Create New Property Owner')}</Button>}
    </Stack>
    <FormErrorMessage>{error ? t(`estate.${error}`) : ''}</FormErrorMessage>
    {creating && <NewOwnerDialog onClose={() => setCreating(false)} onCreated={contact => formik.setFieldValue(path, contact._id)} />}
  </FormControl>;
}
