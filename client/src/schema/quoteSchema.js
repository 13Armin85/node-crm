import { tr } from 'i18n/runtime';
import * as yup from "yup";

export const quoteSchema = yup.object({
  title: yup.string().required(tr("Title Is required")),
  quoteStage: yup.string().required(tr("Quote Stage Is required")),
  validUntil: yup.string().required(tr("Valid Until Is required")),
  shippingPostalcode: yup
    .string()
    .matches(/^\d{6}$/, tr("Shipping Postal Code must be exactly 6 digits"))
    .notRequired(),
  billingPostalcode: yup
    .string()
    .matches(/^\d{6}$/, tr("Billing Postal Code must be exactly 6 digits"))
    .notRequired(),
});
