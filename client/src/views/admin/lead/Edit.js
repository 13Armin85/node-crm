import { useEffect, useState } from 'react';
import { CloseIcon } from '@chakra-ui/icons';
import { Button, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, DrawerOverlay, IconButton } from '@chakra-ui/react';
import { useFormik } from 'formik';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { LocalizedText, tr, withLocalization } from 'i18n/runtime';
import { getApi, putApi } from 'services/api';
import { useFormDefinition, validateFormValues, normalizeFormValues } from 'utils/managedForm';
import CustomForm from 'utils/customForm';
import Spinner from 'components/spinner/Spinner';
import { fetchLeadData } from '../../../redux/slices/leadSlice';

const Edit = props => {
  const { definition, definitionError } = useFormDefinition('Leads');
  const params = useParams();
  const id = props.selectedId || params.id || props.data?._id;
  const dispatch = useDispatch();
  const [initialValues, setInitialValues] = useState(props.data || {});
  const [loading, setLoading] = useState(!props.data);
  useEffect(() => {
    let active = true;
    if (props.data) { setInitialValues(props.data); setLoading(false); return undefined; }
    if (!id) return undefined;
    setLoading(true);
    getApi('api/lead/view/', id).then(response => {
      if (active && response?.status === 200) setInitialValues(response.data.lead || {});
    }).catch(() => { if (active) toast.error(tr('estate.serverError')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, props.data]);
  const formik = useFormik({
    initialValues, enableReinitialize: true,
    validate: values => validateFormValues(definition, values),
    onSubmit: async values => {
      try {
        const response = await putApi(`api/form/edit/${id}`, {
          ...normalizeFormValues(definition, values), moduleId: props.moduleId || props.leadData?._id,
        });
        if (response?.status === 200) {
          props.onClose(false);
          props.setAction(current => !current);
          dispatch(fetchLeadData());
        } else {
          if (response?.data?.field) formik.setFieldError(response.data.field, response.data.code || 'invalid');
          toast.error(response?.data?.message || tr('estate.serverError'));
        }
      } catch {
        toast.error(tr('estate.serverError'));
      }
    },
  });
  const close = () => { props.onClose(false); props.setSelectedId?.(); formik.resetForm(); };
  return <Drawer isOpen={props.isOpen} size={props.size} onClose={close}>
    <DrawerOverlay />
    <DrawerContent className="crm-record-form">
      <DrawerHeader display="flex" alignItems="center" justifyContent="space-between">
        <LocalizedText text="Edit" />
        <IconButton aria-label={tr('Close')} onClick={close} icon={<CloseIcon />} />
      </DrawerHeader>
      <DrawerBody>
        {loading ? <Spinner /> : <CustomForm formik={formik} definition={definition} definitionError={definitionError}
          moduleData={props.leadData} values={formik.values} setFieldValue={formik.setFieldValue}
          handleChange={formik.handleChange} handleBlur={formik.handleBlur} errors={formik.errors} touched={formik.touched} />}
      </DrawerBody>
      <DrawerFooter>
        <Button size="sm" variant="brand" type="submit" isLoading={formik.isSubmitting} disabled={loading || !definition}
          onClick={formik.handleSubmit}><LocalizedText text="Update" /></Button>
        <Button size="sm" variant="outline" colorScheme="red" onClick={close}><LocalizedText text="Close" /></Button>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>;
};
export default withLocalization(Edit);
