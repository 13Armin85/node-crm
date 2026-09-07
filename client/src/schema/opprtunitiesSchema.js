import { tr } from 'i18n/runtime';
import * as yup from "yup";

export const opprtunitiesSchema = yup.object({
  opportunityName: yup.string().required(tr("Opportunity Name Is required")),
  type: yup.string(),
  leadSource: yup.string(),
  currency: yup.string(),
  opportunityAmount: yup.string().required(tr("Opportunity Amount Is required")),
  amount: yup.string(),
  expectedCloseDate: yup.string().required(tr("Expected Close Date Is required")),
  nextStep: yup.string(),
  salesStage: yup.string().required(tr("Sales Stage Is required")),
  probability: yup.string(),
  description: yup.string(),
  createBy: yup.string(),
});
