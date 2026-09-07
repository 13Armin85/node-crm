import { tr } from 'i18n/runtime';
import * as yup from "yup";

export const phoneCallSchema = yup
  .object({
    sender: yup.string().required(tr("Sender Is required")),
    recipient: yup.string().required(tr("Recipient Is required")),
    callDuration: yup.string().required(tr("Call Duration is required")),
    callNotes: yup.string(),
    createBy: yup.string(),
    createByLead: yup.string(),
    category: yup.string(),
    startDate: yup.date().required(tr("Start Date Is required")),
    salesAgent: yup.string().required(tr("Assign To Sales Agent Is required")),
  })
  .test(
    "createBy-or-createByLead-required",
    "Recipient Is required",
    function (value) {
      if (!value?.createBy && !value?.createByLead) {
        return this?.createError({
          path: "createBy",
          message: "Recipient Is required",
        });
      }
    },
  );
