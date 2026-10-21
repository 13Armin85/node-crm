import { CloseIcon } from '@chakra-ui/icons';
import { Button, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, DrawerOverlay, IconButton } from '@chakra-ui/react';
import { useFormik } from 'formik';
import { toast } from 'react-toastify';
import { LocalizedText, tr, withLocalization } from 'i18n/runtime';
import { postApi } from 'services/api';
import { useFormDefinition, validateFormValues, normalizeFormValues } from 'utils/managedForm';
import CustomForm from 'utils/customForm';

const Add = props => {
  const { definition, definitionError } = useFormDefinition('Leads');
  const formik = useFormik({
    initialValues: {},
    validate: values => validateFormValues(definition, values),
    onSubmit: async values => {
      try {
        const response = await postApi('api/form/add', {
          ...normalizeFormValues(definition, values), moduleId: props.leadData?._id,
        });
        if (response?.status === 200) {
          formik.resetForm();
          props.onClose();
          props.setAction(current => !current);
        } else {
          if (response?.data?.field) formik.setFieldError(response.data.field, response.data.code || 'invalid');
          toast.error(response?.data?.message || tr('estate.serverError'));
        }
      } catch {
        toast.error(tr('estate.serverError'));
      }
    },
  });
  const close = () => { formik.resetForm(); props.onClose(); };
  return <Drawer isOpen={props.isOpen} size={props.size} onClose={close}>
    <DrawerOverlay />
    <DrawerContent className="crm-record-form">
      <DrawerHeader display="flex" alignItems="center" justifyContent="space-between">
        <LocalizedText text="Add Lead" />
        <IconButton aria-label={tr('Close')} onClick={close} icon={<CloseIcon />} />
      </DrawerHeader>
      <DrawerBody>
        <CustomForm formik={formik} definition={definition} definitionError={definitionError}
          moduleData={props.leadData} values={formik.values} setFieldValue={formik.setFieldValue}
          handleChange={formik.handleChange} handleBlur={formik.handleBlur} errors={formik.errors} touched={formik.touched} />
      </DrawerBody>
      <DrawerFooter>
        <Button size="sm" variant="brand" type="submit" isLoading={formik.isSubmitting} disabled={!definition}
          onClick={formik.handleSubmit}><LocalizedText text="Save" /></Button>
        <Button size="sm" variant="outline" colorScheme="red" onClick={close}><LocalizedText text="Close" /></Button>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>;
};
export default withLocalization(Add);
