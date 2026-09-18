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
import { MdOutlineRemoveRedEye } from "react-icons/md";
import { RiEyeCloseLine } from "react-icons/ri";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import { userSchema } from "schema";
import { postApi, putApi } from "services/api";
import { setUser } from "../../../redux/slices/localSlice";

const AddEditUser = (props) => {
  const {
    onClose,
    isOpen,
    setAction,
    data,
    userAction,
    selectedId,
    fetchData,
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
    phoneNumber: userAction === "add" ? "" : data?.phoneNumber,
    password: userAction === "add" ? "" : data?.password,
    role: userAction === "add" ? "user" : data?.role || "user",
  };
  const user = JSON.parse(window.localStorage.getItem("user"));

  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: userSchema,
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
    if (userAction === "add") {
      try {
        setIsLoding(true);
        let response = await postApi("api/user/register", values);
        if (response && response?.status === 200) {
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
        let response = await putApi(`api/user/edit/${selectedId}`, values);
        if (response && response?.status === 200) {
          // setEdit(false)
          fetchData();
          if (user?._id === selectedId) {
            let updatedUserData = data; // Create a copy of userData
            if (updatedUserData && typeof updatedUserData === "object") {
              // Create a new object with the updated firstName
              updatedUserData = {
                ...updatedUserData,
                firstName: values?.firstName,
                lastName: values?.lastName,
              };
            }
            const updatedDataString = JSON.stringify(updatedUserData);
            localStorage.setItem("user", updatedDataString);
            dispatch(setUser(updatedDataString));
          }

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
      <ModalContent>
        <ModalHeader justifyContent="space-between" display="flex">
          {userAction === "add" ? tr("Add") : tr("Edit")}<LocalizedText text="User" /><IconButton onClick={onClose} icon={<CloseIcon />} />
        </ModalHeader>
        <ModalBody><ManagedFormLayout moduleName="Users" formik={formik}>
          <Grid templateColumns="repeat(12, 1fr)" gap={3}>
            <GridItem colSpan={{ base: 12 }}>
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
            <GridItem colSpan={{ base: 12 }}>
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
            <GridItem colSpan={{ base: 12 }}>
              <FormLabel ms="4px" fontSize="sm" fontWeight="500" mb="8px"><LocalizedText text="Role" /><Text as="span" color="red">*</Text></FormLabel>
              <Select
                name="role"
                value={values.role}
                onChange={handleChange}
                onBlur={handleBlur}
                isDisabled={userAction === "edit" && user?._id === selectedId}
                borderColor={errors.role && touched.role ? "red.300" : undefined}
              >
                <option value="user">{tr("User")}</option>
                <option value="admin">{tr("Admin")}</option>
              </Select>
              <Text mb="10px" color="red">{errors.role && touched.role && errors.role}</Text>
            </GridItem>
            <GridItem colSpan={{ base: 12 }}>
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
                disabled={userAction === "edit"}
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
            <GridItem colSpan={{ base: 12 }}>
              <FormLabel
                display="flex"
                ms="4px"
                fontSize="sm"
                fontWeight="500"
                mb="8px"
              ><LocalizedText text="Phone Number" /><Text color={"red"}>*</Text>
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
            {userAction !== "edit" && (
              <GridItem colSpan={{ base: 12 }}>
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
