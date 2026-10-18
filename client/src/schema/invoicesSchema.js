import { tr } from 'i18n/runtime';
import * as yup from 'yup';
import { invoiceNumber, normalizeDiscountType, roundMoney } from 'utils/invoiceCalculations';

const number = () => yup.number().transform((value, original) => invoiceNumber(original))
  .typeError(tr('estate.invalid')).min(0, tr('estate.invalid'));
const postalCode = () => yup.string().nullable().transform(value => value?.trim())
  .matches(/^\d{5}$/, { message: tr('estate.invalid'), excludeEmptyString: true }).notRequired();

export const invoicesSchema = yup.object({
  property: yup.string().nullable(),
  transactionType: yup.string().oneOf(['SALE', 'RENT', '']).when('property', {
    is: value => Boolean(value), then: schema => schema.required(tr('estate.required')),
  }),
  title: yup.string().trim().required(tr('Title Is required')),
  billingPostalCode: postalCode(), shippingPostalCode: postalCode(),
  currency: yup.string().oneOf(['TRY', 'USD', 'EUR']).required(tr('estate.required')),
  shipping: number(),
  ptax: number().oneOf([0, 1, 8, 10, 18, 20], tr('estate.invalid')),
  items: yup.array().of(yup.object({
    productName: yup.string(),
    qty: number(), rate: number(),
    discountType: yup.string().oneOf(['none', 'percent', 'flatAmount', 'Percentage', 'Fixed']),
    discount: number().test('discount-limit', tr('estate.invalid'), function (value) {
      const item = this.parent, type = normalizeDiscountType(item.discountType);
      return type === 'none' || (type === 'percent' ? value <= 100 : value <= roundMoney(invoiceNumber(item.qty) * invoiceNumber(item.rate)));
    }),
  })),
});
