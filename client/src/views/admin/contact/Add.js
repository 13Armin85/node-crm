import { LocalizedText, tr, withLocalization } from 'i18n/runtime';
import { CloseIcon } from "@chakra-ui/icons";
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  IconButton,
} from "@chakra-ui/react";
import Spinner from "components/spinner/Spinner";
import { useFormik } from "formik";
import { useState } from "react";
import { postApi } from "services/api";
import { useFormDefinition, validateFormValues, normalizeFormValues } from 'utils/managedForm';
import { toast } from 'react-toastify';
import CustomForm from "utils/customForm";

const Add = (props) => {
  const { definition, definitionError } = useFormDefinition('Contacts');
  const [isLoding, setIsLoding] = useState(false);

  const initialFieldValues = Object?.fromEntries(
    (props?.contactData?.fields || [])?.map((field) => [field?.name, ""]),
  );
  const initialValues = {
    ...initialFieldValues,
    createBy: JSON.parse(localStorage.getItem("user"))._id,
  };

  const formik = useFormik({
    initialValues: initialValues,
    validate: values => validateFormValues(definition, values),
    onSubmit: (values, { resetForm }) => {
      AddData();
    },
  });

  const {
    errors,
    touched,
    values,
    handleBlur,
    handleChange,
    handleSubmit,
    setFieldValue,
  } = formik;

  const AddData = async () => {
    try {
      setIsLoding(true);
      let response = await postApi("api/form/add", {
        ...normalizeFormValues(definition, values),
        moduleId: props?.contactData?._id,
      });
      if (response?.status === 200) {
        props.onClose();
        props.setAction((pre) => !pre);
        formik.resetForm();
      } else {
        if (response?.data?.field) formik.setFieldError(response.data.field, response.data.code || 'invalid');
        toast.error(response?.data?.message || tr('estate.serverError'));
      }
    } catch (e) {
      console.log(e);
    } finally {
      setIsLoding(false);
    }
  };

  const handleCancel = () => {
    formik.resetForm();
    props.onClose();
  };

  return (
    <div>
      <Drawer isOpen={props?.isOpen} size={props?.size}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerHeader
            alignItems={"center"}
            justifyContent="space-between"
            display="flex"
          ><LocalizedText text="Add Contact" /><IconButton onClick={props?.onClose} icon={<CloseIcon />} />
          </DrawerHeader>
          <DrawerBody>
            <CustomForm
              definition={definition}
              definitionError={definitionError}
              moduleData={props?.contactData}
              values={values}
              setFieldValue={setFieldValue}
              handleChange={handleChange}
              handleBlur={handleBlur}
              errors={errors}
              touched={touched}
            />
          </DrawerBody>

          <DrawerFooter>
            <Button
              sx={{ textTransform: "capitalize" }}
              variant="brand"
              disabled={isLoding || !definition}
              type="submit"
              size="sm"
              onClick={handleSubmit}
            >
              {isLoding ? <Spinner /> : tr("Save")}
            </Button>
            <Button
              variant="outline"
              colorScheme="red"
              size="sm"
              sx={{
                marginLeft: 2,
                textTransform: "capitalize",
              }}
              onClick={handleCancel}
            ><LocalizedText text="Close" /></Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default withLocalization(Add);
