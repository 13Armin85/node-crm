import { tr } from 'i18n/runtime';
import * as yup from "yup";

export const leadSchema = yup.object({
  // Lead Information:
  leadName: yup.string(),
  leadEmail: yup.string().email(),
  leadPhoneNumber: yup
    .number()
    .min(1000000000, tr("Phone number is invalid"))
    .max(999999999999, tr("Phone number is invalid"))
    ,
  leadAddress: yup.string(),
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
  leadCreationDate: yup.date(),
  leadConversionDate: yup.date(),
  leadFollowUpDate: yup.date(),
  leadFollowUpStatus: yup.string(),
  // Lead Scoring and Nurturing:
  leadScore: yup
    .number()

    .min(0, tr("Lead Score Is invalid")),
  leadNurturingWorkflow: yup.string(),
  leadEngagementLevel: yup.string(),
  leadConversionRate: yup.number(),
  leadNurturingStage: yup.string(),
  leadNextAction: yup.string(),
});
