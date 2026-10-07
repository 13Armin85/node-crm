import React from 'react';
import { Alert, AlertIcon, Box, Spinner } from '@chakra-ui/react';
import DynamicFormRenderer from './DynamicFormRenderer';
import { useFormDefinition } from 'utils/managedForm';
import { useLanguage } from 'i18n';

export default function FormExtension({ moduleName, formik }) {
  const { t } = useLanguage();
  const { definition, definitionError: error } = useFormDefinition(moduleName);
  if (error) return <Alert status="error"><AlertIcon />{t('estate.serverError')}</Alert>;
  if (!definition) return <Spinner />;
  return <Box mt={4}><DynamicFormRenderer definition={definition} formik={formik} customOnly /></Box>;
}
