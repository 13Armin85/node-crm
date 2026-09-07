import React, { useEffect, useState } from 'react';
import { Alert, AlertIcon, Box, Spinner } from '@chakra-ui/react';
import DynamicFormRenderer from './DynamicFormRenderer';
import { getApi } from 'services/api';
import { useLanguage } from 'i18n';

export default function FormExtension({ moduleName, formik }) {
  const { t } = useLanguage();
  const [definition, setDefinition] = useState(null); const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    getApi(`api/estate/definitions/${encodeURIComponent(moduleName)}`).then(r => { if (active) { if (r.status === 200) setDefinition(r.data); else setError(true); } });
    return () => { active = false; };
  }, [moduleName]);
  if (error) return <Alert status="error"><AlertIcon />{t('estate.serverError')}</Alert>;
  if (!definition) return <Spinner />;
  return <Box mt={4}><DynamicFormRenderer definition={definition} formik={formik} customOnly /></Box>;
}
