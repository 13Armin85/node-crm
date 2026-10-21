import { LocalizedText, tr, withLocalization } from 'i18n/runtime';
import ManagedFormLayout from 'components/dynamicForm/ManagedFormLayout';
import { CloseIcon, PhoneIcon } from "@chakra-ui/icons";
import {
  Button,
  FormLabel,
  Grid,
  GridItem,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
} from "@chakra-ui/react";
import Spinner from "components/spinner/Spinner";
import { useFormik } from "formik";
import React, { useState } from "react";
import { useFormDefinition, validateFormValues } from "utils/managedForm";
import { MdOutlineRemoveRedEye } from "react-icons/md";
import { RiEyeCloseLine } from "react-icons/ri";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import { userSchema } from "schema";
import { postApi, putApi } from "services/api";
import { setUser } from "../../../redux/slices/localSlice";
import { isDeveloper, isAdmin, canEditUser } from 'roles';
import { getStoredUser, updateSessionUser } from 'services/authSession';

const AddEditUser = (props) => {
  const {
    onClose,
    isOpen,
    setAction,
    data,
    userAction,
    selectedId,
    setUserAction,
  } = props;
  const [isLoding, setIsLoding] = useState(false);
  const [show, setShow] = React.useState(false);
  const showPass = () => setShow(!show);
  const dispatch = useDispatch();

  const initialValues = {
    customFields: data?.customFields || {},
    firstName: userAction === "add" ? "" : data?.firstName,
    lastName: userAction === "add" ? "" : data?.lastName,
    username: userAction === "add" ? "" : data?.username,
    phoneNumber: userAction === "add" ? "" : data?.phoneNumber ?? "",
    password: userAction === "add" ? "" : data?.password,
    role: userAction === "add" ? "user" : data?.role || "user",
  };
  const user = getStoredUser();
  const { definition, definitionError } = useFormDefinition('Users', isOpen);



  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: definition ? undefined : userSchema,
    validate: values => validateFormValues(definition, values),
    enableReinitialize: true,
    onSubmit: (values) => {
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
    resetForm,
  } = formik;

  const AddData = async () => {
    if (userAction === 'add' && !isDeveloper(user)) return;
    if (userAction === 'edit' && !canEditUser(user, data)) return;
    if (userAction === "add") {
      try {
        setIsLoding(true);
        const payload = { ...values };
        if (!String(payload.phoneNumber ?? "").trim()) delete payload.phoneNumber;
        let response = await postApi("api/user/register", payload);
        if (response && response?.status === 200) {
          toast.success(tr("Saved successfully"), { toastId: "user-save", autoClose: 6000 });
          resetForm();
          setAction((pre) => !pre);
          setUserAction("");
          onClose();
        } else {
          toast.error(response?.response?.data?.message);
        }
      } catch (e) {
        console.log(e);
      } finally {
        setIsLoding(false);
      }
    } else if (userAction === "edit") {
      try {
        setIsLoding(true);
        const payload = { ...values };
        if (!isAdmin(user)) delete payload.role;
        let response = await putApi(`api/user/edit/${selectedId}`, payload);
        if (response && response?.status === 200) {
          if (user?._id === selectedId && response.data.user) {
            const updatedUser = updateSessionUser(response.data.user);
            if (updatedUser) dispatch(setUser(updatedUser));
          }
          toast.success(tr("Saved successfully"), { toastId: "user-save", autoClose: 6000 });

          setUserAction("");
          setAction((pre) => !pre);
          onClose();
        } else {
          toast.error(response?.response?.data?.message);
        }
      } catch (e) {
        console.log(e);
      } finally {
        setIsLoding(false);
      }
    }
  };
  return (
    <Modal isOpen={isOpen} isCentered>
      <ModalOverlay />
      <ModalContent className="crm-record-form">
        <ModalHeader justifyContent="space-between" display="flex">
          {userAction === "add" ? tr("Add") : tr("Edit")}<LocalizedText text="User" /><IconButton onClick={onClose} icon={<CloseIcon />} />
        </ModalHeader>
        <ModalBody><ManagedFormLayout moduleName="Users" formik={formik} definition={definition} definitionError={definitionError}>
          <Grid templateColumns="repeat(12, 1fr)" gap={3}>
            <GridItem order={0} colSpan={{ base: 12 }}>
              <FormLabel
                display="flex"
                ms="4px"
                fontSize="sm"
                fontWeight="500"
                mb="8px"
              ><LocalizedText text="First Name" /><Text color={"red"}>*</Text>
              </FormLabel>
              <Input
                fontSize="sm"
                onChange={handleChange}
                onBlur={handleBlur}
                value={values?.firstName}
                name="firstName"
                placeholder={tr("firstName")}
                fontWeight="500"
                borderColor={
                  errors?.firstName && touched?.firstName ? "red.300" : null
                }
              />
              <Text mb="10px" color={"red"}>
                {" "}
                {errors?.firstName && touched?.firstName && errors?.firstName}
              </Text>
            </GridItem>
            <GridItem order={1} colSpan={{ base: 12 }}>
              <FormLabel
                display="flex"
                ms="4px"
                fontSize="sm"
                fontWeight="500"
                mb="8px"
              ><LocalizedText text="Last Name" /></FormLabel>
              <Input
                fontSize="sm"
                onChange={handleChange}
                onBlur={handleBlur}
                value={values?.lastName}
                name="lastName"
                placeholder={tr("Last Name")}
                fontWeight="500"
                borderColor={
                  errors?.lastName && touched?.lastName ? "red.300" : null
                }
              />
              <Text mb="10px" color={"red"}>
                {" "}
                {errors?.lastName && touched?.lastName && errors?.lastName}
              </Text>
            </GridItem>
            <GridItem order={2} colSpan={{ base: 12 }}>
              <FormLabel
                display="flex"
                ms="4px"
                fontSize="sm"
                fontWeight="500"
                mb="8px"
              ><LocalizedText text="Email" /><Text color={"red"}>*</Text>
              </FormLabel>
              <Input
                fontSize="sm"
                type="email"
                onChange={handleChange}
                onBlur={handleBlur}
                value={values?.username}
                name="username"
                placeholder={tr("Email Address")}
                fontWeight="500"
                borderColor={
                  errors?.username && touched?.username ? "red.300" : null
                }
              />
              <Text mb="10px" color={"red"}>
                {" "}
                {errors?.username && touched?.username && errors?.username}
              </Text>
            </GridItem>
            {userAction !== "edit" && (
              <GridItem order={(definition?.fields.find(field => field.name === "username")?.order ?? 2) + 0.5} colSpan={{ base: 12 }}>
                <FormLabel
                  display="flex"
                  ms="4px"
                  fontSize="sm"
                  fontWeight="500"
                  mb="8px"
                ><LocalizedText text="Password" /></FormLabel>
                <InputGroup size="md">
                  <Input
                    isRequired={true}
                    fontSize="sm"
                    placeholder={tr("Enter Your Password")}
                    name="password"
                    size="lg"
                    variant="auth"
                    type={show ? "text" : "password"}
                    value={values?.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    borderColor={
                      errors?.password && touched?.password ? "red.300" : null
                    }
                    className={
                      errors?.password && touched?.password ? "isInvalid" : null
                    }
                  />
                  <InputRightElement
                    display="flex"
                    alignItems="center"
                    mt="4px"
                  >
                    <Icon
                      color={"gray.400"}
                      _hover={{ cursor: "pointer" }}
                      as={show ? RiEyeCloseLine : MdOutlineRemoveRedEye}
                      onClick={showPass}
                    />
                  </InputRightElement>
                </InputGroup>
                <Text mb="10px" color={"red"}>
                  {" "}
                  {errors?.password && touched?.password && errors?.password}
                </Text>
              </GridItem>
            )}
            <GridItem order={4} colSpan={{ base: 12 }}>
              <FormLabel
                display="flex"
                ms="4px"
                fontSize="sm"
                fontWeight="500"
                mb="8px"
              ><LocalizedText text="Phone Number" />
              </FormLabel>
              <InputGroup>
                <InputLeftElement
                  pointerEvents="none"
                  children={<PhoneIcon color="gray.300" borderRadius="16px" />}
                />
                <Input
                  type="tel"
                  fontSize="sm"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values?.phoneNumber}
                  name="phoneNumber"
                  fontWeight="500"
                  borderColor={
                    errors?.phoneNumber && touched?.phoneNumber
                      ? "red.300"
                      : null
                  }
                  placeholder={tr("Phone number")}
                  borderRadius="16px"
                />
              </InputGroup>
              <Text mb="10px" color={"red"}>
                {errors?.phoneNumber &&
                  touched?.phoneNumber &&
                  errors?.phoneNumber}
              </Text>
            </GridItem>
            <GridItem order={5} colSpan={{ base: 12 }}>
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" mb="8px"><LocalizedText text="Role" /><Text as="span" color="red">*</Text></FormLabel>
              <Select
                name="role"
                value={values.role}
                onChange={handleChange}
                onBlur={handleBlur}
                isDisabled={!isAdmin(user) || (userAction === "edit" && user?._id === selectedId)}
                borderColor={errors.role && touched.role ? "red.300" : undefined}
              >
                <option value="user">{tr("User")}</option>
                <option value="admin">{tr("Admin")}</option>
                {isDeveloper(user) && <option value="developer">{tr("Developer")}</option>}
              </Select>
              <Text mb="10px" color="red">{errors.role && touched.role && errors.role}</Text>
            </GridItem>
          </Grid>
        </ManagedFormLayout>
</ModalBody>
        <ModalFooter>
          <Button
            variant="brand"
            size="sm"
            disabled={isLoding ? true : false}
            onClick={handleSubmit}
          >
            {isLoding ? <Spinner /> : tr("Save")}
          </Button>
          <Button
            sx={{
              marginLeft: 2,
              textTransform: "capitalize",
            }}
            variant="outline"
            colorScheme="red"
            size="sm"
            onClick={() => {
              formik.resetForm();
              onClose();
            }}
          ><LocalizedText text="Close" /></Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default withLocalization(AddEditUser);
