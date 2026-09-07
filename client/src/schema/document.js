import { tr } from 'i18n/runtime';
import * as yup from "yup";

// Define the yup schema for the main document
export const documentSchema = yup.object().shape({
  folderName: yup.string().required(tr("Folder Name is required")),
  filename: yup.string().min(2, tr("File Name Must Be At Least 2 Characters")),
  createBy: yup.string().required(),
});
