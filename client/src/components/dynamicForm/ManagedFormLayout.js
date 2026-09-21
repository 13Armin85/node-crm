import React, { useEffect, useState } from 'react';
import { Alert, AlertIcon, Box } from '@chakra-ui/react';
import { getApi } from 'services/api';
import { translate, useLanguage } from 'i18n';
import DynamicFormRenderer, { localized } from './DynamicFormRenderer';
import { formLabel, formValue } from 'utils/formValue';

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
  const optionText = value => {
    if (value == null || typeof value === 'boolean') return '';
    if (Array.isArray(value)) return value.map(optionText).join('');
    if (React.isValidElement(value)) {
      if (value.props.text !== undefined) return formLabel(translate(value.props.text, language));
      return optionText(value.props.children);
    }
    return formLabel(translate(value, language));
  };
  const configure = (node, currentField) => {
    if (!React.isValidElement(node)) return node;
    const type = typeof node.type === 'string' ? node.type : node.type?.displayName || node.type?.name || '';
    // React components inside a native option can be stringified by the browser.
    if (type === 'option') return React.cloneElement(node, {
      ...(node.props.value !== undefined ? { value: formValue(node.props.value) } : {}),
      children: optionText(node.props.children) || optionText(node.props.label) || formLabel(formValue(node.props.value)),
    });
    const name = findName(node);
    const field = fields.find(f => f.name === name && f.kind === 'SYSTEM_FIELD');
    const isContainer = /GridItem|FormControl/.test(type);
    if (isContainer && field?.enabled === false) return null;
    const activeField = isContainer ? field : currentField;
    if (/FormLabel/.test(type) && activeField) return React.cloneElement(node, {}, localized(activeField.label, language));
    const patch = {};
    if (field && typeof node.props.name === 'string' && field.placeholder) patch.placeholder = localized(field.placeholder, language);
    if (/^(Select|Input|Textarea|select|input|textarea)$/.test(type) && node.props.value != null) {
      patch.value = typeof node.props.value === 'object'
        ? (type === 'Select' || type === 'select' ? formValue(node.props.value) : formLabel(node.props.value))
        : formValue(node.props.value);
    }
    if (isContainer && field) patch.order = field.order;
    if (node.props.children) patch.children = React.Children.map(node.props.children, child => configure(child, activeField));
    return React.cloneElement(node, patch);
  };
  return <>{failed && <Alert status="error"><AlertIcon />{t('estate.serverError')}</Alert>}{React.Children.map(children, child => configure(child))}
    {definition && <Box className="crm-managed-fields" mt={4}><DynamicFormRenderer definition={definition} formik={formik} customOnly /></Box>}
  </>;
}
