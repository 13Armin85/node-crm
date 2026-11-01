import { toast } from 'react-toastify';
import { tr } from 'i18n/runtime';
import { postApi } from 'services/api';

export async function submitEmail(values, helpers) {
  let response;
  try { response = await postApi('api/email/add', values); }
  catch (_) { /* Display the same retry message as an unsuccessful HTTP response. */ }
  if (response?.status !== 200) {
    const code = response?.data?.code || response?.response?.data?.code;
    const field = response?.data?.field || response?.response?.data?.field;
    if (field) helpers.setFieldError(field, tr(['required', 'invalid', 'relationNotFound'].includes(code) ? 'estate.' + code : 'estate.invalid'));
    toast.error(tr(code === 'emailNotConfigured'
      ? 'Email sending is not configured. Contact the administrator.'
      : 'Email could not be sent. Your message has been kept. Please try again.'));
    return false;
  }
  helpers.resetForm();
  toast.success(tr('Email Send successfully'));
  return true;
}
