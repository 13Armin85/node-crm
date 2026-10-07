import { isAdmin } from 'roles';
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
  Grid,
  GridItem,
  IconButton,
  Flex,
  Select,
  FormLabel,
  Text,
} from "@chakra-ui/react";
import Spinner from "components/spinner/Spinner";
import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { putApi } from "services/api";
import { getApi } from "services/api";
import { useFormDefinition, validateFormValues, normalizeFormValues } from 'utils/managedForm';
import { formValue } from 'utils/formValue';
import { toast } from 'react-toastify';
import CustomForm from "../../../utils/customForm";
import UserModel from "components/commonTableModel/UserModel";
import { LiaMousePointerSolid } from "react-icons/lia";
import SelectPorpertyModel from "components/commonTableModel/SelectPorpertyModel";
// import { fetchLeadData } from "redux/slices/leadSlice";
import { fetchLeadData } from "../../../redux/slices/leadSlice";
import { useDispatch } from "react-redux";
import RelationFields from "components/relations/RelationFields";

const Edit = (props) => {
  const { definition, definitionError } = useFormDefinition('Leads');
  const { data } = props;
  const user = JSON.parse(localStorage.getItem("user"));
  const dispatch = useDispatch();
  const [isLoding, setIsLoding] = useState(false);
  const initialFieldValues = Object.fromEntries(
    (props?.leadData?.fields || [])?.map((field) => [field?.name, ""])
  );
  const [propertyModel, setPropertyModel] = useState(false);
  const [propertyList, setPropertyList] = useState([]);
  const [userModel, setUserModel] = useState(false);
  const [userData, setUserData] = useState([]);
  const [initialValues, setInitialValues] = useState({
    ...initialFieldValues,
    createBy: JSON.parse(localStorage.getItem("user"))._id,
  });
  const param = useParams();

  const formik = useFormik({
    initialValues: initialValues,
    enableReinitialize: true,
    validate: values => validateFormValues(definition, values),
    onSubmit: (values, { resetForm }) => {
      EditData();
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

  const EditData = async () => {
    try {
      setIsLoding(true);
      let response = await putApi(
        `api/form/edit/${props?.selectedId || param?.id || data?._id}`,
        { ...normalizeFormValues(definition, values), moduleId: props?.moduleId || props?.leadData?._id }
      );
      if (response?.status === 200) {
        props.onClose();
        props.setAction((pre) => !pre);
        dispatch(fetchLeadData());
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

  const getPropertyList = async () => {
    let result = await getApi(
      isAdmin(user)
        ? "api/property"
        : `api/property/?createBy=${user?._id}`
    );

    setPropertyList(result?.data);
  };

  useEffect(() => {
    getPropertyList();
  }, []);

  const handleClose = () => {
    props.onClose(false);
    props.setSelectedId && props?.setSelectedId();
    formik.resetForm();
  };

  let response;
  const fetchData = async () => {
    if (data) {
      setInitialValues((prev) => ({
        ...prev,
        ...data,
        associatedListing: formValue(data?.associatedListing),
        contact: formValue(data?.contact) || null,
        partnerCustomer: formValue(data?.partnerCustomer) || null,
        assignUser: formValue(data?.assignUser),
      }));
    } else if (props?.selectedId || param?.id) {
      try {
        setIsLoding(true);
        response = await getApi("api/lead/view/", props?.selectedId || param?.id);
        let editData = response?.data?.lead;
        setInitialValues((prev) => ({
          ...prev,
          ...editData,
          associatedListing: formValue(editData?.associatedListing),
          contact: formValue(editData?.contact) || null,
          partnerCustomer: formValue(editData?.partnerCustomer) || null,
          assignUser: formValue(editData?.assignUser),
        }));
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoding(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [props?.selectedId, data]);

  useEffect(() => {
    fetchUserDetails();
  }, []);

  const fetchUserDetails = async () => {
    let result = await getApi("api/task/assignees");
    setUserData(result?.data);
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
          ><LocalizedText text="Edit" />{values?.leadName || "Lead "}
            <IconButton onClick={handleClose} icon={<CloseIcon />} />
          </DrawerHeader>
          <DrawerBody>
            {isLoding ? (
              <Flex
                justifyContent={"center"}
                alignItems={"center"}
                width="100%"
              >
                <Spinner />
              </Flex>
            ) : (
              <CustomForm
                definition={definition}
                definitionError={definitionError}
                moduleData={props?.leadData}
                values={values}
                setFieldValue={setFieldValue}
                handleChange={handleChange}
                handleBlur={handleBlur}
                errors={errors}
                touched={touched}
              />
            )}
            <RelationFields values={values} setFieldValue={setFieldValue} contact partner />
            <Grid templateColumns="repeat(12, 1fr)" gap={3} mt={2}>
              <GridItem colSpan={{ base: 12 }}>
                <FormLabel
                  display="flex"
                  ms="4px"
                  fontSize="sm"
                  fontWeight="500"
                  mb="8px"
                ><LocalizedText text="Associated Listing" /></FormLabel>
                <Flex justifyContent="space-between">
                  <Select
                    value={values?.associatedListing || ""}
                    name="associatedListing"
                    onChange={handleChange}
                    fontWeight="500"
                    placeholder={tr("select associated listing")}
                  >
                    {propertyList?.map((item) => {
                      return (
                        <option value={item?._id} key={item?._id}>
                          {item?.name}
                        </option>
                      );
                    })}
                  </Select>
                  <IconButton
                    onClick={() => setPropertyModel(true)}
                    ml={2}
                    fontSize="25px"
                    icon={<LiaMousePointerSolid />}
                  />
                </Flex>
              </GridItem>
            </Grid>

            <Grid templateColumns="repeat(12, 1fr)" gap={3} mt={2}>
              <GridItem colSpan={{ base: 12 }}>
                <FormLabel
                  display="flex"
                  ms="4px"
                  fontSize="sm"
                  fontWeight="500"
                  mb="8px"
                ><LocalizedText text="Assign to User" /></FormLabel>
                <Flex justifyContent="space-between">
                  <Select
                    value={values?.assignUser}
                    name="assignUser"
                    onChange={handleChange}
                    fontWeight="500"
                    placeholder={tr("select user")}
                  >
                    {userData?.map((item) => {
                      return (
                        <option value={item?._id} key={item?._id}>
                          {item?.firstName} {item?.lastName}
                        </option>
                      );
                    })}
                  </Select>
                  <IconButton
                    onClick={() => setUserModel(true)}
                    ml={2}
                    fontSize="25px"
                    icon={<LiaMousePointerSolid />}
                  />
                </Flex>
              </GridItem>
            </Grid>
          </DrawerBody>
          <SelectPorpertyModel
            onClose={() => setPropertyModel(false)}
            isOpen={propertyModel}
            data={propertyList}
            isLoding={isLoding}
            setIsLoding={setIsLoding}
            fieldName="associatedListing"
            setFieldValue={setFieldValue}
          />
          <UserModel
            onClose={() => setUserModel(false)}
            isOpen={userModel}
            fieldName={"assignUser"}
            setFieldValue={setFieldValue}
            data={userData}
            isLoding={isLoding}
            setIsLoding={setIsLoding}
          />
          <DrawerFooter>
            <Button
              sx={{ textTransform: "capitalize" }}
              variant="brand"
              size="sm"
              type="submit"
              disabled={isLoding || !definition}
              onClick={handleSubmit}
            >
              {isLoding ? <Spinner /> : tr("Update")}
            </Button>
            <Button
              variant="outline"
              colorScheme="red"
              size="sm"
              sx={{
                marginLeft: 2,
                textTransform: "capitalize",
              }}
              onClick={handleClose}
            ><LocalizedText text="Close" /></Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default withLocalization(Edit);
