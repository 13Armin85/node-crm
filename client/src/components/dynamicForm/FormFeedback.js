import React from 'react';
import { Alert, AlertIcon } from '@chakra-ui/react';
import { useLanguage } from 'i18n';
export default function FormFeedback({ formik }) {
  const { t } = useLanguage();
  if (!formik?.submitCount || formik.isValidating || !Object.keys(formik.errors || {}).length) return null;
  return <Alert status="error" role="alert" mb={4}><AlertIcon />{t('Please complete the required fields and correct the highlighted errors.')}</Alert>;
}
