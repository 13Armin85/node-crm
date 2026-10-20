import { tr } from 'i18n/runtime';
import * as yup from "yup";

export const userSchema = yup.object({
  role: yup.string().oneOf(["developer", "admin", "user"]).required(tr("Role Is required")),
  firstName: yup.string().required(tr("First Name Is required")),
  lastName: yup.string(),
  phoneNumber: yup
    .number()
    .transform((value, original) => original == null || (typeof original === "string" && !original.trim()) ? undefined : value)
    .nullable()
    .optional()
    .typeError("Invalid Phone Number")
    .min(1000000000, tr("Phone Number is invalid"))
    .max(999999999999, tr("Phone Number is invalid")),
  username: yup
    .string()
    .email(tr("Email must be a valid email"))
    .required(tr("Email Is required")),
});
