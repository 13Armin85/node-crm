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
  Select,
  Text,
  Button,
} from "@chakra-ui/react";
import Spinner from "components/spinner/Spinner";
import {
  setSearchValue,
  setGetTagValues,
  getSearchData,
} from "../../../../redux/slices/advanceSearchSlice";
import { useDispatch, useSelector } from "react-redux";

const TaskAdvanceSearch = (props) => {
  const {
    state,
    allData,
    advanceSearch,
    setAdvanceSearch,
    isLoding,
    setSearchedData,
    setDisplaySearchData,
    setSearchbox,
  } = props;
  const dispatch = useDispatch();
  const searchResult = useSelector(
    (state) => state?.advanceSearchData?.searchResult,
  );
  const initialValues = {
    title: "",
    category: "",
    start: "",
    end: "",
    status: "",
    leadAddress: "",
    assignToName: "",
    fromLeadScore: "",
    toLeadScore: "",
  };
  const validationSchema = yup.object({
    title: yup.string(),
    category: yup.string(),
    start: yup.date(),
    end: yup.date(),
    leadAddress: yup.string(),
    assignToName: yup.string(),
    fromLeadScore: yup.number().min(0, tr("From Lead Score is invalid")),
    toLeadScore: yup
      .number()
      .min(
        yup.ref("fromLeadScore"),
        tr("To Lead Score must be greater than or equal to From Lead Score"),
      ),
  });
  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: (values, { resetForm }) => {
      dispatch(setSearchValue(values));
      dispatch(
        getSearchData({ values: values, allData: allData, type: "Tasks" }),
      );
      const getValue = [
        {
          name: ["title"],
          value: values?.title,
        },
        {
          name: ["status"],
          value: values?.status,
        },
        {
          name: ["category"],
          value: values?.category,
        },
        {
          name: ["assignToName"],
          value: values?.assignToName,
        },
        {
          name: ["start"],
          value: values?.start,
        },
        {
          name: ["end"],
          value: values?.end,
        },
      ];

      dispatch(setGetTagValues(getValue?.filter((item) => item?.value)));

      setSearchedData(searchResult);
      setDisplaySearchData(true);
      setAdvanceSearch(false);
      resetForm();
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
    setFieldValue,
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
              <GridItem colSpan={{ base: 12, md: 6 }}>
                <FormLabel
                  display="flex"
                  ms="4px"
                  fontSize="sm"
                  fontWeight="600"
                  color={"#000"}
                  mb="0"
                  mt={2}
                ><LocalizedText text="Title" /></FormLabel>
                <Input
                  fontSize="sm"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values?.title}
                  name="title"
                  placeholder={tr("Enter Title")}
                  fontWeight="500"
                />
                <Text mb="10px" color={"red"}>
                  {" "}
                  {errors?.title && touched?.title && errors?.title}
                </Text>
              </GridItem>
              <GridItem colSpan={{ base: 12, md: 6 }}>
                <FormLabel
                  display="flex"
                  ms="4px"
                  fontSize="sm"
                  fontWeight="600"
                  color={"#000"}
                  mb="0"
                  mt={2}
                ><LocalizedText text="Status" /></FormLabel>
                <Select
                  value={values?.status}
                  fontSize="sm"
                  name="status"
                  onChange={handleChange}
                  fontWeight="500"
                >
                  {!state && <option value=""><LocalizedText text="Select Status" /></option>}
                  <option value="completed"><LocalizedText text="Completed" /></option>
                  <option value="todo"><LocalizedText text="Todo" /></option>
                  <option value="pending"><LocalizedText text="Pending" /></option>
                  <option value="inProgress"><LocalizedText text="In Progress" /></option>
                  <option value="onHold"><LocalizedText text="On Hold" /></option>
                </Select>
                <Text mb="10px" color={"red"}>
                  {" "}
                  {errors?.status && touched?.status && errors?.status}
                </Text>
              </GridItem>
              <GridItem colSpan={{ base: 12, md: 6 }}>
                <FormLabel
                  display="flex"
                  ms="4px"
                  fontSize="sm"
                  fontWeight="600"
                  color={"#000"}
                  mb="0"
                  mt={2}
                ><LocalizedText text="Related" /></FormLabel>
                <Select
                  value={values?.category}
                  fontSize="sm"
                  name="category"
                  onChange={handleChange}
                  fontWeight="500"
                  placeholder={tr("Select Category")}
                >
                  <option value="contact"><LocalizedText text="Contact" /></option>
                  <option value="lead"><LocalizedText text="Lead" /></option>
                  <option value="none"><LocalizedText text="None" /></option>
                </Select>

                <Text mb="10px" color={"red"}>
                  {" "}
                  {errors?.category && touched?.category && errors?.category}
                </Text>
              </GridItem>
              <GridItem colSpan={{ base: 12, md: 6 }}>
                <FormLabel
                  display="flex"
                  ms="4px"
                  fontSize="sm"
                  fontWeight="600"
                  color={"#000"}
                  mb="0"
                  mt={2}
                ><LocalizedText text="Assign To" /></FormLabel>
                <Input
                  fontSize="sm"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values?.assignToName}
                  name="assignToName"
                  placeholder={tr("Enter Assign To")}
                  fontWeight="500"
                />
                <Text mb="10px" color={"red"}>
                  {" "}
                  {errors?.assignToName &&
                    touched?.assignToName &&
                    errors?.assignToName}
                </Text>
              </GridItem>
              <GridItem colSpan={{ base: 12, md: 6 }}>
                <FormLabel
                  display="flex"
                  ms="4px"
                  fontSize="sm"
                  fontWeight="600"
                  color={"#000"}
                  mb="0"
                  mt={2}
                ><LocalizedText text="Start Date" /></FormLabel>
                <Input
                  fontSize="sm"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values?.start}
                  name="start"
                  type="date"
                  placeholder={tr("Enter Start Date")}
                  fontWeight="500"
                />
                <Text mb="10px" color={"red"}>
                  {" "}
                  {errors?.start && touched?.start && errors?.start}
                </Text>
              </GridItem>
              <GridItem colSpan={{ base: 12, md: 6 }}>
                <FormLabel
                  display="flex"
                  ms="4px"
                  fontSize="sm"
                  fontWeight="600"
                  color={"#000"}
                  mb="0"
                  mt={2}
                ><LocalizedText text="End Date" /></FormLabel>
                <Input
                  fontSize="sm"
                  type="date"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values?.end}
                  min={values?.start}
                  name="end"
                  placeholder={tr("Enter  End Date")}
                  fontWeight="500"
                />
                <Text mb="10px" color={"red"}>
                  {" "}
                  {errors?.end && touched?.end && errors?.end}
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

export default withLocalization(TaskAdvanceSearch);
