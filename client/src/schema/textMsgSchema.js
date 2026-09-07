import { tr } from 'i18n/runtime';
import * as yup from "yup";

export const textMsgSchema = yup.object({
  sender: yup
    .string()
    .min(1000000000, tr("Phone number is invalid"))
    .max(999999999999, tr("Phone number is invalid"))
    .required(tr("Sender Is required")),
  to: yup
    .string()
    .min(1000000000, tr("Phone number is invalid"))
    .max(999999999999, tr("Phone number is invalid"))
    .required(tr("To Is required")),
  message: yup.string(),
  createFor: yup.string().required(tr("Create By Is required")),
});
