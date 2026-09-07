import { tr } from 'i18n/runtime';
import * as yup from "yup";

export const validationAddSchema = yup.object({
  name: yup.string().min(2).required(tr("Name is required")),
});
