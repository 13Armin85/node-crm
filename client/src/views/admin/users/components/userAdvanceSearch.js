import { LocalizedText, tr, withLocalization } from 'i18n/runtime';
import React from "react";
import { useFormik } from "formik";
import * as yup from "yup";
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Grid,
  GridItem,
  Input,
  FormLabel,
  Text,
  Button,
} from "@chakra-ui/react";
import Spinner from "components/spinner/Spinner";
import {
  getSearchData,
  setGetTagValues,
  setSearchValue,
} from "../../../../redux/slices/advanceSearchSlice";
import { useDispatch } from "react-redux";

const UserAdvanceSearch = (props) => {
  const {
    allData,
    advanceSearch,
    setAdvanceSearch,
    isLoding,
    setDisplaySearchData,
    setSearchbox,
  } = props;

  const dispatch = useDispatch();

  const initialValues = {
    firstName: "",
    username: "",
    lastName: "",
  };
  const validationSchema = yup.object({
    firstName: yup.string(),
    username: yup.string().email(tr("User Email is invalid")),
    lastName: yup.string(),
  });
  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: (values, { resetForm }) => {
      dispatch(setSearchValue(values));
      dispatch(
        getSearchData({ values: values, allData: allData, type: "Users" }),
      );
      resetForm();
      const getValue = [
        {
          name: ["firstName"],
          value: values?.firstName,
        },
        {
          name: ["lastName"],
          value: values?.lastName,
        },
        {
          name: ["username"],
          value: values?.username,
        },
      ];
      dispatch(setGetTagValues(getValue?.filter((item) => item?.value)));
      // setSearchedData(searchResult);
      setDisplaySearchData(true);
      setAdvanceSearch(false);
      setSearchbox("");
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
    dirty,
  } = formik;

  return (
    <>
      <Modal
        onClose={() => {
          setAdvanceSearch(false);
          resetForm();
        }}
        isOpen={advanceSearch}
        isCentered
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader><LocalizedText text="Advance Search" /></ModalHeader>
          <ModalCloseButton
            onClick={() => {
              setAdvanceSearch(false);
              resetForm();
            }}
          />
          <ModalBody>
            <Grid templateColumns="repeat(12, 1fr)" mb={3} gap={2}>
              <GridItem colSpan={{ base: 12 }}>
                <FormLabel
                  display="flex"
                  ms="4px"
                  fontSize="sm"
                  fontWeight="600"
                  color={"#000"}
                  mb="0"
                  mt={2}
                ><LocalizedText text="First Name" /></FormLabel>
                <Input
                  fontSize="sm"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values?.firstName}
                  name="firstName"
                  placeholder={tr("Enter First Name")}
                  fontWeight="500"
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
                  fontWeight="600"
                  color={"#000"}
                  mb="0"
                  mt={2}
                ><LocalizedText text="Last Name" /></FormLabel>
                <Input
                  fontSize="sm"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values?.lastName}
                  name="lastName"
                  placeholder={tr("Enter Last Name")}
                  fontWeight="500"
                />
                <Text mb="10px" color={"red"}>
                  {" "}
                  {errors?.lastName && touched?.lastName && errors?.lastName}
                </Text>
              </GridItem>
              <GridItem colSpan={{ base: 12 }}>
                <FormLabel
                  display="flex"
                  ms="4px"
                  fontSize="sm"
                  fontWeight="600"
                  color={"#000"}
                  mb="0"
                  mt={2}
                ><LocalizedText text="Email Id" /></FormLabel>
                <Input
                  fontSize="sm"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values?.username}
                  name="username"
                  placeholder={tr("Enter User Name")}
                  fontWeight="500"
                />
                <Text mb="10px" color={"red"}>
                  {" "}
                  {errors?.username && touched?.username && errors?.username}
                </Text>
              </GridItem>
            </Grid>
          </ModalBody>
          <ModalFooter>
            <Button
              size="sm"
              variant="brand"
              mr={2}
              onClick={handleSubmit}
              disabled={isLoding || !dirty ? true : false}
            >
              {isLoding ? <Spinner /> : tr("Search")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              colorScheme="red"
              onClick={() => resetForm()}
            ><LocalizedText text="Clear" /></Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default withLocalization(UserAdvanceSearch);
