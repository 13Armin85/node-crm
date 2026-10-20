import React, { useEffect, useState } from 'react';
import { Alert, AlertIcon, Box, Button, FormControl, FormErrorMessage, FormLabel, IconButton, Input, InputGroup, InputRightElement, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Stack, Text } from '@chakra-ui/react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useFormik } from 'formik';
import { useLanguage } from 'i18n';
import { postApi } from 'services/api';

const messages = {
  required: 'estate.required', invalid: 'estate.invalid', incorrectPassword: 'The current password is incorrect.',
  passwordTooShort: 'Password must contain at least 8 characters.', passwordTooLong: 'The new password is too long.',
  passwordMismatch: 'Passwords do not match.', samePassword: 'The new password must differ from the current password.',
  passwordChangeConflict: 'Your session changed. Please sign in again.', unauthorized: 'Your session changed. Please sign in again.',
  rateLimited: 'estate.rateLimited',
};
const fields = [['currentPassword', 'Current Password', 'current-password'], ['newPassword', 'New Password', 'new-password'], ['confirmPassword', 'Confirm New Password', 'new-password']];
export default function ChangePasswordDialog({ isOpen, onClose, onChanged }) {
  const { t, direction } = useLanguage();
  const [failure, setFailure] = useState(''), [visible, setVisible] = useState({});
  const formik = useFormik({
    initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    validate(values) {
      const errors = {};
      fields.forEach(([field]) => { if (!values[field].trim()) errors[field] = messages.required; });
      const password = values.newPassword.trim();
      if (password && password.length < 8) errors.newPassword = messages.passwordTooShort;
      else if (new Blob([password]).size > 72) errors.newPassword = messages.passwordTooLong;
      else if (password && password === values.currentPassword.trim()) errors.newPassword = messages.samePassword;
      if (values.confirmPassword && values.confirmPassword.trim() !== password) errors.confirmPassword = messages.passwordMismatch;
      return errors;
    },
    async onSubmit(values, helpers) {
      setFailure('');
      try {
        const response = await postApi('api/user/change-password', values);
        if (response?.status === 200) { helpers.resetForm(); onClose(); onChanged(); return; }
        const message = messages[response?.data?.code] || 'Password change failed. Please try again.';
        if (fields.some(([field]) => field === response?.data?.field)) helpers.setFieldError(response.data.field, message);
        setFailure(message);
      } catch { setFailure('Password change failed. Please try again.'); }
    },
  });
  useEffect(() => { if (!isOpen) { formik.resetForm(); setFailure(''); setVisible({}); } }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => { if (!formik.isSubmitting) onClose(); };
  return <Modal isOpen={isOpen} onClose={close} isCentered closeOnEsc={!formik.isSubmitting} closeOnOverlayClick={!formik.isSubmitting}>
    <ModalOverlay /><ModalContent dir={direction} className="crm-password-modal">
      <Box as="form" onSubmit={formik.handleSubmit} noValidate>
        <ModalHeader>{t('Change Password')}</ModalHeader><ModalCloseButton isDisabled={formik.isSubmitting} />
        <ModalBody><Stack spacing={4}>
          <Text color="var(--crm-muted)" fontSize="sm">{t('After changing your password, sign in again on your devices.')}</Text>
          {failure && <Alert status="error"><AlertIcon /><Box role="alert">{t(failure)}</Box></Alert>}
          {fields.map(([name, label, autoComplete]) => <FormControl key={name} isRequired isInvalid={Boolean(formik.touched[name] && formik.errors[name])}>
            <FormLabel htmlFor={`password-${name}`}>{t(label)}</FormLabel>
            <InputGroup>
              <Input id={`password-${name}`} name={name} type={visible[name] ? 'text' : 'password'} dir="ltr" autoComplete={autoComplete} {...formik.getFieldProps(name)} isDisabled={formik.isSubmitting} pe="3rem" />
              <InputRightElement><IconButton type="button" size="sm" variant="ghost" aria-label={t(visible[name] ? 'Hide password' : 'Show password')} icon={visible[name] ? <FiEyeOff /> : <FiEye />} onClick={() => setVisible(current => ({ ...current, [name]: !current[name] }))} /></InputRightElement>
            </InputGroup>
            {name === 'newPassword' && <Text fontSize="xs" color="var(--crm-muted)" mt={1}>{t('Password must contain at least 8 characters.')}</Text>}
            <FormErrorMessage>{t(formik.errors[name])}</FormErrorMessage>
          </FormControl>)}
        </Stack></ModalBody>
        <ModalFooter gap={2}><Button type="submit" variant="brand" isLoading={formik.isSubmitting}>{t('Change Password')}</Button><Button type="button" variant="outline" isDisabled={formik.isSubmitting} onClick={close}>{t('Cancel')}</Button></ModalFooter>
      </Box>
    </ModalContent>
  </Modal>;
}
