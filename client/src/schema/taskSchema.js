import { tr } from 'i18n/runtime';
import * as yup from "yup";

export const TaskSchema = yup.object({
  title: yup.string().required(tr("Title Is required")),
  category: yup.string(),
  description: yup.string(),
  notes: yup.string(),
  // assignTo: yup.string(),
  // assignToLead: yup.string(),
  reminder: yup.string(),
  start: yup.string().required(tr("Start Date Is required")),
  end: yup.string(),
  backgroundColor: yup.string(),
  borderColor: yup.string(),
  textColor: yup.string(),
  priority: yup.string().oneOf(["low", "normal", "high", "urgent"]),
  display: yup.string(),
  url: yup.string(),
  createBy: yup.string(),
});
