import { tr } from 'i18n/runtime';
import * as yup from "yup";

export const loginSchema = yup.object({
  username: yup.string().email().required(tr("Email Is required")),
  password: yup.string().required(tr("Password Is required")),
});
