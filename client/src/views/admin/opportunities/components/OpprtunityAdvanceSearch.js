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
  getSearchData,
  setGetTagValues,
} from "../../../../redux/slices/advanceSearchSlice";
import { useDispatch } from "react-redux";

const OpprtunityAdvanceSearch = (props) => {
  const {
    state,
    allData,
    advanceSearch,
    setAdvanceSearch,
    isLoding,
    setSearchedData,
    setDisplaySearchData,
    setSearchClear,
    setSearchbox,
  } = props;

  const dispatch = useDispatch();
  const initialValues = {
    opportunityName: "",
    accountName2: "",
    opportunityAmount: "",
    expectedCloseDate: "",
    salesStage: "",
  };
  const validationSchema = yup.object({
    opportunityName: yup.string(),
    accountName2: yup.string(),
    opportunityAmount: yup.string(),
    expectedCloseDate: yup.string(),
    salesStage: yup.string(),
  });
  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: (values, { resetForm }) => {
      dispatch(setSearchValue(values));
      dispatch(
        getSearchData({ values: values, allData: allData, type: "Opprtunity" }),
      );
      // const searchResult = allData?.filter(
      //     (item) =>
      //         (!values?.senderName || (item?.senderName && item?.senderName.toLowerCase().includes(values?.senderName?.toLowerCase()))) &&
      //         (!values?.realetedTo || (values.realetedTo === "contact" ? item.createBy : item.createByLead)) &&
      //         (!values?.createByName || (item?.createByName && item?.createByName.toLowerCase().includes(values?.createByName?.toLowerCase())))
      // )
      // let getValue = [values.senderName, values?.realetedTo, values?.createByName].filter(value => value);
      const getValue = [
        {
          name: ["opportunityName"],
          value: values?.opportunityName,
        },
        {
          name: ["accountName2"],
          value: values?.accountName2,
        },
        {
          name: ["opportunityAmount"],
          value: values?.opportunityAmount,
        },
        {
          name: ["expectedCloseDate"],
          value: values?.expectedCloseDate,
        },
        {
          name: ["salesStage"],
          value: values?.salesStage,
        },
      ];
      dispatch(setGetTagValues(getValue?.filter((item) => item?.value)));
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
                ><LocalizedText text="Opportunity Name" /></FormLabel>
                <Input
                  fontSize="sm"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values?.opportunityName}
                  name="opportunityName"
                  placeholder={tr("Enter Opportunity Name")}
                  fontWeight="500"
                />
                <Text mb="10px" color={"red"}>
                  {" "}
                  {errors?.opportunityName &&
                    touched?.opportunityName &&
                    errors?.opportunityName}
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
                ><LocalizedText text="Account Name" /></FormLabel>
                <Input
                  fontSize="sm"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values?.accountName2}
                  name="accountName2"
                  placeholder={tr("Enter Account Name")}
                  fontWeight="500"
                />
                <Text mb="10px" color={"red"}>
                  {" "}
                  {errors?.accountName2 &&
                    touched?.accountName2 &&
                    errors?.accountName2}
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
                ><LocalizedText text="Opportunity Amount" /></FormLabel>
                <Input
                  fontSize="sm"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values?.opportunityAmount}
                  name="opportunityAmount"
                  placeholder={tr("Enter Opportunity Amount")}
                  fontWeight="500"
                />
                <Text mb="10px" color={"red"}>
                  {" "}
                  {errors?.opportunityAmount &&
                    touched?.opportunityAmount &&
                    errors?.opportunityAmount}
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
                ><LocalizedText text="Expected Close Date" /></FormLabel>
                <Input
                  fontSize="sm"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values?.expectedCloseDate}
                  name="expectedCloseDate"
                  type="date"
                  fontWeight="500"
                />
                <Text mb="10px" color={"red"}>
                  {" "}
                  {errors?.expectedCloseDate &&
                    touched?.expectedCloseDate &&
                    errors?.expectedCloseDate}
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
                ><LocalizedText text="Sales Stage" /></FormLabel>
                <Select
                  value={values?.salesStage}
                  name="salesStage"
                  onChange={handleChange}
                  fontWeight="500"
                  placeholder={tr("Sales Stage")}
                >
                  <option value={"Prospecting"}><LocalizedText text="Prospecting" /></option>
                  <option value={"Qualification"}><LocalizedText text="Qualification" /></option>
                  <option value={"Needs Analysis"}><LocalizedText text="Needs Analysis" /></option>
                  <option value={"Value Propositon"}><LocalizedText text="Value Propositon" /></option>
                  <option value={"Identifying Decision Makers"}><LocalizedText text="Identifying Decision Makers" /></option>
                  <option value={"Perception Analysis"}><LocalizedText text="Perception Analysis" /></option>
                  <option value={"Proposal/Price Quote"}><LocalizedText text="Proposal/Price Quote" /></option>
                  <option value={"Negotiation/Review"}><LocalizedText text="Negotiation/Review" /></option>
                  <option value={"Closed/Won"}><LocalizedText text="Closed/Won" /></option>
                  <option value={"Closed/Lost"}><LocalizedText text="Closed/Lost" /></option>
                </Select>
                <Text mb="10px" color={"red"}>
                  {" "}
                  {errors?.salesStage &&
                    touched?.salesStage &&
                    errors?.salesStage}
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

export default withLocalization(OpprtunityAdvanceSearch);
