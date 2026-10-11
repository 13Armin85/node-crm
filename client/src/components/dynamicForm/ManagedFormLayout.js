import React from 'react';
import { Alert, AlertIcon, Box, FormControl, FormErrorMessage, FormLabel, GridItem, Text } from '@chakra-ui/react';
import { useFormDefinition, useRequiredFields } from 'utils/managedForm';
import { getIn } from 'formik';
import { translate, useLanguage } from 'i18n';
import DynamicFormRenderer, { localized, isVisible } from './DynamicFormRenderer';
import { formLabel, formValue } from 'utils/formValue';

const findNames = node => {
  if (!React.isValidElement(node)) return [];
  if (typeof node.props.name === 'string') return [node.props.name];
  return [...new Set(React.Children.toArray(node.props.children).flatMap(findNames))];
};
// Keep existing widgets and dependent business flows; configure their surrounding fields.
export default function ManagedFormLayout({ moduleName, formik, children, definition: providedDefinition, definitionError, includeCustom = true }) {
  const { language, t } = useLanguage();
  const { definition: loadedDefinition, definitionError: failed } = useFormDefinition(moduleName, providedDefinition === undefined);
  const definition = providedDefinition !== undefined ? providedDefinition : loadedDefinition;
  const fields = definition?.fields || [];
  const renderedNames = React.Children.toArray(children).flatMap(findNames);
  useRequiredFields(fields.filter(field => field.kind === 'SYSTEM_FIELD' && renderedNames.includes(field.name)), formik);
  const hasControl = node => React.isValidElement(node) && (node.type === FormControl || React.Children.toArray(node.props.children).some(hasControl));
  const message = error => ['required', 'invalid', 'relationNotFound'].includes(error) ? t(`estate.${error}`) : error;

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
    const names = findNames(node);
    const name = names.length === 1 ? names[0] : null;
    const field = fields.find(f => f.name === name && f.kind === 'SYSTEM_FIELD');
    const isContainer = node.type === GridItem || node.type === FormControl || /GridItem|FormControl/.test(type);
    if (field && !isVisible(field, formik?.values || {}) && (isContainer || typeof node.props.name === 'string')) return null;
    const activeField = isContainer ? field : currentField;
    if ((node.type === FormLabel || /FormLabel/.test(type)) && activeField) return React.cloneElement(node, {}, <>{localized(activeField.label, language)}{activeField.required && <Box as="span" color="red.500" ms={1}>*</Box>}</>);
    // The configured field owns one error message below its widget.
    if (activeField && (node.type === FormErrorMessage || ((node.type === Text || type === 'Text') && ['red', 'red.500'].includes(node.props.color)))) return null;
    const patch = {};
    if (field && typeof node.props.name === 'string' && field.placeholder) patch.placeholder = localized(field.placeholder, language);
    if (/^(Select|Input|Textarea|select|input|textarea)$/.test(type) && node.props.value != null) {
      patch.value = typeof node.props.value === 'object'
        ? (type === 'Select' || type === 'select' ? formValue(node.props.value) : formLabel(node.props.value))
        : formValue(node.props.value);
    }
    if (isContainer && field) patch.order = field.order;
    if (node.props.children) patch.children = React.Children.map(node.props.children, child => configure(child, activeField));
    if (isContainer && field && !React.Children.toArray(node.props.children).some(hasControl)) {
      const error = getIn(formik?.errors, name);
      const showError = Boolean(error && (formik?.submitCount > 0 || getIn(formik?.touched, name)));
      const content = <>{patch.children}<FormErrorMessage>{showError ? localized(field.validationMessage, language) || message(error) : ''}</FormErrorMessage></>;
      if (node.type === FormControl || /FormControl/.test(type)) {
        patch.isInvalid = showError; patch.isRequired = Boolean(field.required); patch.children = content;
      } else patch.children = <FormControl isInvalid={showError} isRequired={Boolean(field.required)}>{content}</FormControl>;
    }
    return React.cloneElement(node, patch);
  };
  return <>{(failed || definitionError) && <Alert status="error"><AlertIcon />{t('estate.serverError')}</Alert>}{React.Children.map(children, child => configure(child))}
    {includeCustom && definition && <Box className="crm-managed-fields" mt={4}><DynamicFormRenderer definition={definition} formik={formik} customOnly /></Box>}
  </>;
}
