import React, { useEffect, useState } from "react";
import { useFormik } from "formik";
import { Box, Button, Flex, FormControl, FormLabel, Grid, GridItem, Input, Modal,
  ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select } from "@chakra-ui/react";
import { FiCalendar, FiChevronDown, FiSearch, FiSliders } from "react-icons/fi";
import CalendarDateInput from "components/date/CalendarDateInput";
import { tr, withLocalization } from "i18n/runtime";
import { optionText } from "./searchFields";

const AdvanceSearch = ({ handleAdvanceSearch, setAdvaceSearch, advaceSearch, isLoding, tableCustomFields = [] }) => {
  const [showDates, setShowDates] = useState(false);
  const initialValues = Object.fromEntries(tableCustomFields.flatMap(field => field.type === "date"
    ? [[`from${field.name}`, ""], [`to${field.name}`, ""]] : [[field.name, ""]]));
  const formik = useFormik({ initialValues, enableReinitialize: true,
    onSubmit: (values, { resetForm }) => {
      if (isLoding) return;
      handleAdvanceSearch(values);
      resetForm();
    },
  });
  useEffect(() => { if (!advaceSearch) setShowDates(false); }, [advaceSearch]);
  const close = () => { setAdvaceSearch(false); formik.resetForm(); setShowDates(false); };
  const fields = tableCustomFields.filter(field => field.type !== "date");
  const dates = tableCustomFields.filter(field => field.type === "date");
  const activeDates = dates.filter(field => formik.values[`from${field.name}`] || formik.values[`to${field.name}`]).length;
  const fieldProps = name => ({ id: name, name, value: formik.values[name] ?? "", onChange: formik.handleChange, onBlur: formik.handleBlur });

  return <Modal isOpen={advaceSearch} onClose={close} isCentered size="lg" scrollBehavior="inside">
    <ModalOverlay />
    <ModalContent className="crm-advanced-search crm-advanced-search--compact" as="form" onSubmit={formik.handleSubmit} noValidate>
      <ModalHeader><Flex align="center" gap={2}><FiSliders aria-hidden="true" /><span>{tr("Advance Search")}</span></Flex></ModalHeader>
      <ModalCloseButton aria-label={tr("Close")} />
      <ModalBody>
        <Grid className="crm-filter-fields" templateColumns={{ base: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }} gap={3}>
          {fields.map(field => <GridItem key={field.name}>
            <FormControl>
              <FormLabel htmlFor={field.name}>{tr(field.label)}</FormLabel>
              {field.type === "select" ? <Select {...fieldProps(field.name)}>
                <option value="">{tr("Select")}</option>
                {field.options?.map(option => <option key={option._id || option.value} value={option.value}>{tr(optionText(option))}</option>)}
              </Select> : <Input {...fieldProps(field.name)} type={field.type === "phone" ? "tel" : field.type} placeholder={tr(field.label)} />}
            </FormControl>
          </GridItem>)}
        </Grid>
        {dates.length > 0 && <Box className="crm-filter-dates">
          <Button className="crm-filter-dates__toggle" type="button" variant="ghost" aria-expanded={showDates} aria-controls="crm-filter-date-fields" onClick={() => setShowDates(value => !value)}>
            <FiCalendar aria-hidden="true" /><span>{tr("search.dates")}</span>
            {activeDates > 0 && <span className="crm-filter-dates__count">{activeDates}</span>}
            <FiChevronDown className="crm-filter-dates__chevron" aria-hidden="true" />
          </Button>
          <Box id="crm-filter-date-fields" hidden={!showDates}>
            {dates.map(field => <Box as="fieldset" className="crm-filter-date-field" key={field.name}>
              <Box as="legend">{tr(field.label)}</Box>
              <Flex className="crm-advanced-search__range" gap={2}>
                {["from", "to"].map(bound => <FormControl key={bound}>
                  <FormLabel htmlFor={`${bound}${field.name}`}>{tr(bound === "from" ? "From" : "To")}</FormLabel>
                  <CalendarDateInput {...fieldProps(`${bound}${field.name}`)}
                    min={bound === "to" ? formik.values[`from${field.name}`] : undefined}
                    aria-label={`${tr(bound === "from" ? "From" : "To")} ${tr(field.label)}`} />
                </FormControl>)}
              </Flex>
            </Box>)}
          </Box>
        </Box>}
      </ModalBody>
      <ModalFooter>
        <Button type="submit" variant="brand" leftIcon={<FiSearch />} isLoading={isLoding} isDisabled={isLoding}>{tr("search.apply")}</Button>
        <Button type="button" variant="ghost" onClick={() => formik.resetForm()}>{tr("Clear")}</Button>
      </ModalFooter>
    </ModalContent>
  </Modal>;
};
export default withLocalization(AdvanceSearch);
