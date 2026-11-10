import { LocalizedText, tr, withLocalization } from 'i18n/runtime';
import {
  Box,
  Alert,
  AlertIcon,
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  FormLabel,
  Input,
  Text,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { useFormik } from "formik";
import Spinner from "components/spinner/Spinner";
import ManagedFormLayout from 'components/dynamicForm/ManagedFormLayout';
import { useFormDefinition } from 'utils/managedForm';
import { postApi } from "services/api";
import { documentSchema } from "schema";
import Upload from "../views/admin/document/component/Upload";

const AddDocumentModal = ({
  setAddDocument,
  addDocument,
  linkId,
  from,
  fetchData,
}) => {
  const [isLoding, setIsLoding] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const { definition, definitionError } = useFormDefinition('Documents');
  // A folder's name is required when creating the folder, but an uploaded
  // document may use the same unfiled storage offered by the document center.
  const uploadDefinition = definition && { ...definition, fields: definition.fields.map(field =>
    field.kind === 'SYSTEM_FIELD' && field.name === 'folderName' ? { ...field, required: false } : field) };
  const user = JSON.parse(localStorage.getItem("user"));

  const initialValues = {
    folderName: "",
    files: [],
    customFields: {},
    filename: "",
    linkLead: from === "lead" && linkId,
    linkContact: from === "contact" && linkId,
    entityType: { lead: 'Lead', contact: 'Contact', opportunity: 'Opportunity' }[from],
    entityId: linkId,
    createBy: user?._id,
  };

  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: documentSchema,
    onSubmit: () => addData(),
  });
  const {
    errors,
    touched,
    values,
    handleChange,
    handleSubmit,
    setFieldValue,
    resetForm,
  } = formik;

  const addData = async () => {
    let closeOnSuccess = false;
    try {
      setIsLoding(true);
      setSubmitError('');
      if (!values.files.length) { formik.setFieldError('files', tr('Select at least one file')); return; }
      const payload = new FormData();
      for (const [key, value] of Object.entries(values)) {
        if (key === 'files') value.forEach(file => payload.append('files', file));
        else if (key === 'customFields') payload.append(key, JSON.stringify(value));
        else if (value !== false && value != null) payload.append(key, value);
      }

      let response = await postApi(
        "api/document/add",
        payload,
      );
      if (response && response?.status === 200) {
        formik.resetForm();
        await fetchData?.(2);
        closeOnSuccess = true;
      } else {
        const failure = response?.data || response?.response?.data;
        const message = tr('estate.' + (failure?.code || 'serverError'));
        setSubmitError(message);
        if (failure?.field) formik.setFieldError(failure.field, message);
      }
    } catch (e) {
      setSubmitError(tr('estate.serverError'));
    } finally {
      setIsLoding(false);
      if (closeOnSuccess) setAddDocument(false);
    }
  };
  return (
    <Modal
      onClose={() => setAddDocument(false)}
      isOpen={addDocument}
      isCentered
    >
      <ModalOverlay />
      <ModalContent className="crm-record-form" maxWidth={"2xl"}>
        <ModalHeader>{tr('Add Document')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {submitError && <Alert status="error" mb={3}><AlertIcon />{submitError}</Alert>}
          <ManagedFormLayout moduleName="Documents" formik={formik} definition={uploadDefinition} definitionError={definitionError}>
          <Box gridColumn="1 / -1">
            <FormLabel
              display="flex"
              ms="4px"
              fontSize="sm"
              fontWeight="500"
              mb="8px"
            ><LocalizedText text="Folder Name" /> <Text as="span" ms={1} color="gray.500">({tr('Optional')})</Text>
            </FormLabel>
            <Input
              fontSize="sm"
              onChange={handleChange}
              value={values?.folderName}
              name="folderName"
              placeholder={tr("Enter Folder Name")}
              fontWeight="500"
              borderColor={
                errors?.folderName && touched?.folderName ? "red.300" : null
              }
            />
            <Text fontSize="xs" color="gray.500" mt={1}>{tr('No folder — publish directly')}</Text>
            <Text mb="10px" color={"red"}>
              {" "}
              {errors?.folderName && touched?.folderName && errors?.folderName}
            </Text>
          </Box>
          <Box gridColumn="1 / -1">
            <FormLabel
              display="flex"
              ms="4px"
              fontSize="sm"
              fontWeight="500"
              mb="8px"
            ><LocalizedText text="File Name" /></FormLabel>
            <Input
              fontSize="sm"
              onChange={handleChange}
              value={values?.filename}
              name="filename"
              placeholder={tr("Enter File Name")}
              fontWeight="500"
              borderColor={
                errors?.filename && touched?.filename ? "red.300" : null
              }
            />
            <Text mb="10px" color={"red"}>
              {" "}
              {errors?.filename && touched?.filename && errors?.filename}
            </Text>
          </Box>
          <Box gridColumn="1 / -1"><Upload
            count={values?.files?.length}
            onFileSelect={(file) => setFieldValue("files", file)}
          />
          {errors.files && <Text color="red.500">{errors.files}</Text>}</Box>
        </ManagedFormLayout></ModalBody>
        <ModalFooter>
          <Button
            size="sm"
            variant="brand"
            mr={2}
            onClick={handleSubmit}
            disabled={isLoding ? true : false}
          >
            {isLoding ? <Spinner /> : tr("Save")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            colorScheme="red"
            onClick={() => {
              setAddDocument(false);
              resetForm();
            }}
          ><LocalizedText text="Close" /></Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default withLocalization(AddDocumentModal);
