import React, { useEffect, useState } from 'react';
import { Alert, AlertIcon, Box } from '@chakra-ui/react';
import { getApi } from 'services/api';
import { useLanguage } from 'i18n';
import DynamicFormRenderer, { localized } from './DynamicFormRenderer';

const findName = node => {
  if (!React.isValidElement(node)) return null;
  if (typeof node.props.name === 'string') return node.props.name;
  return React.Children.toArray(node.props.children).map(findName).find(Boolean);
};
// Keep existing widgets and dependent business flows; configure their surrounding fields.
export default function ManagedFormLayout({ moduleName, formik, children }) {
  const { language, t } = useLanguage();
  const [definition, setDefinition] = useState(null); const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    getApi(`api/estate/definitions/${encodeURIComponent(moduleName)}`).then(r => { if (active) { if (r.status === 200) setDefinition(r.data); else setFailed(true); } });
    return () => { active = false; };
  }, [moduleName]);
  const fields = definition?.fields || [];
  const configure = (node, currentField) => {
    if (!React.isValidElement(node)) return node;
    const type = typeof node.type === 'string' ? node.type : node.type.displayName || node.type.name || '';
    // Native options must keep a primitive text child. Recursively cloning their
    // content can make the browser stringify a React/localized value as
    // "[object Object]" in a closed select.
    if (type === 'option') return node;
    const name = findName(node);
    const field = fields.find(f => f.name === name && f.kind === 'SYSTEM_FIELD');
    const isContainer = /GridItem|FormControl/.test(type);
    if (isContainer && field?.enabled === false) return null;
    const activeField = isContainer ? field : currentField;
    if (/FormLabel/.test(type) && activeField) return React.cloneElement(node, {}, localized(activeField.label, language));
    const patch = {};
    if (field && typeof node.props.name === 'string' && field.placeholder) patch.placeholder = localized(field.placeholder, language);
    if (isContainer && field) patch.order = field.order;
    if (node.props.children) patch.children = React.Children.map(node.props.children, child => configure(child, activeField));
    return React.cloneElement(node, patch);
  };
  return <>{failed && <Alert status="error"><AlertIcon />{t('estate.serverError')}</Alert>}{React.Children.map(children, child => configure(child))}
    {definition && <Box className="crm-managed-fields" mt={4}><DynamicFormRenderer definition={definition} formik={formik} customOnly /></Box>}
  </>;
}
