import { tr } from 'i18n/runtime';
import * as yup from "yup";

export const userSchema = yup.object({
  firstName: yup.string().required(tr("First Name Is required")),
  lastName: yup.string(),
  // phoneNumber: yup.string().required("Phone Number Is required").matches(/^\d{10}$/, "Phone Number must be exactly 10 digits"),
  phoneNumber: yup
    .number()
    .typeError("Invalid Phone Number")
    .min(1000000000, tr("Phone Number is invalid"))
    .max(999999999999, tr("Phone Number is invalid"))
    .required(tr("Phone Number is Required")),
  username: yup
    .string()
    .email(tr("Email must be a valid email"))
    .required(tr("Email Is required")),
});
