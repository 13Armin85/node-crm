import { tr } from 'i18n/runtime';
import * as yup from "yup";

export const invoicesSchema = yup.object({
  property: yup.string().nullable(),
  transactionType: yup.string().oneOf(['SALE', 'RENT', '']).when('property', {
    is: value => Boolean(value), then: schema => schema.required(tr('estate.required')),
  }),
  title: yup.string().required(tr("Title Is required")),
  shippingPostalcode: yup
    .string()
    .matches(/^\d{6}$/, tr("Shipping Postal Code must be exactly 6 digits"))
    .notRequired(),
  billingPostalcode: yup
    .string()
    .matches(/^\d{6}$/, tr("Billing Postal Code must be exactly 6 digits"))
    .notRequired(),
});
