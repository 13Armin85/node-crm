import { tr } from 'i18n/runtime';
import * as yup from 'yup';

export const emailSchema = yup.object({
  sender: yup.string().required(tr('Sender Is required')),
  recipient: yup.string().trim().email(tr('Invalid Email')).required(tr('Recipient Is required')),
  cc: yup.string().email(),
  bcc: yup.string().email(),
  subject: yup.string().trim().required(tr('Subject Is required')),
  type: yup.string(),
  message: yup.string().when('type', {
    is: type => type !== 'template',
    then: schema => schema.test('message-required', tr('Message Is required'), value => typeof value === 'string' && Boolean(value.trim())),
  }),
  html: yup.string().when('type', {
    is: 'template', then: schema => schema.trim().required(tr('Select Template')),
  }),
  startDate: yup.date().nullable().transform((value, original) => original === '' ? null : value),
  createBy: yup.string(),
  createByContact: yup.string(),
  createByLead: yup.string(),
  salesAgent: yup.string(),
});
