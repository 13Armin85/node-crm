import { tr } from 'i18n/runtime';
import * as yup from "yup";

export const leadSchema = yup.object({
  // Lead Information:
  leadName: yup.string().required(tr("Lead Name Is required")),
  leadEmail: yup.string().email().required(tr("Lead Email Is required")),
  leadPhoneNumber: yup
    .number()
    .min(1000000000, tr("Phone number is invalid"))
    .max(999999999999, tr("Phone number is invalid"))
    .required(tr("Lead Phone Number Is required")),
  leadAddress: yup.string().required(tr("Lead Address Is required")),
  // Lead Source and Details:
  leadSource: yup.string(),
  leadStatus: yup.string(),
  leadSourceDetails: yup.string(),
  leadCampaign: yup.string(),
  leadSourceChannel: yup.string(),
  leadSourceMedium: yup.string(),
  leadSourceCampaign: yup.string(),
  leadSourceReferral: yup.string(),
  // Lead Assignment and Ownership:
  leadAssignedAgent: yup.string(),
  leadOwner: yup.string(),
  leadCommunicationPreferences: yup.string(),
  // Lead Dates and Follow-up:
  leadCreationDate: yup.date().required(tr("Lead Creation Date Is required")),
  leadConversionDate: yup.date().required(tr("Lead Conversion Date Is required")),
  leadFollowUpDate: yup.date().required(tr("lead Follow Up Date  Is required")),
  leadFollowUpStatus: yup.string(),
  // Lead Scoring and Nurturing:
  leadScore: yup
    .number()
    .required(tr("Lead Score Is required"))
    .min(0, tr("Lead Score Is invalid")),
  leadNurturingWorkflow: yup.string(),
  leadEngagementLevel: yup.string(),
  leadConversionRate: yup.number().required(tr("lead Conversion Rate Is required")),
  leadNurturingStage: yup.string(),
  leadNextAction: yup.string(),
});
