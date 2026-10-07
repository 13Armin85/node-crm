import { parseImportSpreadsheet } from "utils/importSpreadsheet";
import { LocalizedText, tr, withLocalization } from 'i18n/runtime';
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Flex,
  useColorModeValue,
  Select,
  Button,
  Text,
  Grid,
  GridItem,
} from "@chakra-ui/react";
import { useFormik } from "formik";
import { postApi } from "services/api";
import { toast } from "react-toastify";
import moment from "moment";
import Card from "components/card/Card";

function OpportunityprojectImport() {
  const location = useLocation();
  const { fileData, customFields } = location.state || {};
  const [importedFileFields, setImportedFileFields] = useState([]);
  const [importedFileData, setImportedFileData] = useState([]);
  const [isLoding, setIsLoding] = useState(false);
  const navigate = useNavigate();
  const userId = JSON.parse(localStorage.getItem("user"))._id;
  const [filterContact, setFilterContact] = useState([]);

  const columns = [
    { Header: tr("Fields In Crm"), accessor: "crmFields" },
    { Header: tr("Fields In File"), accessor: "fileFields" },
  ];

  const initialFieldValues = Object.fromEntries(
    (customFields || []).map((field) => [field?.name, ""]),
  );
  const initialValues = {
    ...initialFieldValues,
  };

  const fieldsInCrm = [
    ...customFields?.map((field) => ({
      Header: field?.label,
      accessor: field?.name,
      type: field?.type,
      formikType: field?.validations?.find((obj) =>
        obj.hasOwnProperty("formikType"),
      ),
    })),
  ];

  const formik = useFormik({
    initialValues: initialValues,
    onSubmit: (values, { resetForm }) => {
      const contactsData = importedFileData?.map((item, ind) => {
        const contact = {
          createdDate: new Date(),
          deleted: item[values.deleted || "deleted"] || false,
          createBy: JSON.parse(localStorage.getItem("user"))._id,
        };

        fieldsInCrm?.forEach((field) => {
          const selectedField = values[field?.accessor];
          const fieldValue = item[selectedField] || "";

          if (field?.type?.toLowerCase() === "date") {
            contact[field?.accessor] = moment(fieldValue).isValid()
              ? fieldValue
              : "";
          } else if (
            field?.type?.toLowerCase() === "number" &&
            ["positive", "negative"].includes(field?.formikType?.toLowerCase())
          ) {
            contact[field?.accessor] = parseFloat(fieldValue) || "";
          } else if (field?.type?.toLowerCase() === "number") {
            contact[field?.accessor] = parseInt(fieldValue, 10) || "";
          } else {
            contact[field?.accessor] = fieldValue;
          }
        });

        return contact;
      });

      AddData(contactsData);
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
  } = formik;
  const AddData = async (contacts) => {
    try {
      setIsLoding(true);
      let response = await postApi("api/opportunityproject/addMany", contacts);
      if (response.status === 200) {
        toast.success(`Opportunity Project imported successfully`);
        resetForm();
        navigate("/opportunityproject");
      }
    } catch (e) {
      console.error(e);
      toast.error(`Opportunity Project import failed`);
      resetForm();
      navigate("/opportunityproject");
    } finally {
      setIsLoding(false);
    }
  };

  const parseFileData = async (file) => {
    try {
      const rows = await parseImportSpreadsheet(file);
      setImportedFileData(rows);
      setImportedFileFields(Object.keys(rows[0]));
    } catch {
      setImportedFileData([]);
      setImportedFileFields([]);
      toast.error(tr("Empty or invalid import file. Maximum 100 rows and 15 MB."));
    }
  };

  useEffect(() => {
    if (fileData && fileData.length > 0) {
      const firstFile = fileData[0];
      parseFileData(firstFile);
    }
  }, [fileData]);

  useEffect(() => {
    const filterContactData = importedFileFields?.filter((field) => {
      const result = fieldsInCrm?.find(
        (data) => field === data?.accessor || field === data?.Header,
      );
      if (result) {
        setFieldValue(result?.accessor, field);
        return true;
      }
      return false;
    });
    setFilterContact(filterContactData);
  }, [importedFileFields]);

  return (
    <>
      <Card overflowY={"auto"} className="importTable">
        <Text
          color={"secondaryGray.900"}
          fontSize="22px"
          fontWeight="700"
          mb="20px"
        ><LocalizedText text="Import Opportunity Project" /></Text>
        <Grid
          templateColumns="repeat(12, 1fr)"
          mb={3}
          pb={2}
          gap={1}
          borderBottom={"1px solid #e2e8f0"}
        >
          {columns.map((column, index) => (
            <GridItem
              key={index}
              colSpan={{ base: 6 }}
              fontWeight={"600"}
              fontSize={{ sm: "14px", lg: "14px" }}
              color="secondaryGray.900"
              style={{ textTransform: "uppercase" }}
            >
              {column.Header}
            </GridItem>
          ))}
        </Grid>
        <Grid
          templateColumns="repeat(12, 1fr)"
          mb={3}
          gap={1}
          overflowY={"auto"}
        >
          {fieldsInCrm?.map((item, index) => (
            <>
              <GridItem colSpan={{ base: 6 }} key={item?.id} mt="10px">
                {item?.Header}
              </GridItem>
              <GridItem colSpan={{ base: 4 }}>
                <Select
                  variant="flushed"
                  fontWeight="500"
                  isSearchable
                  value={values[item?.accessor]}
                  name={item?.accessor}
                  onChange={handleChange}
                >
                  <option value="">
                    {" "}
                    {filterContact
                      ? filterContact?.find(
                          (data) =>
                            (item?.Header === data ||
                              item?.accessor === data) &&
                            data,
                        )
                        ? filterContact?.find(
                            (data) =>
                              (item?.Header === data ||
                                item?.accessor === data) &&
                              data,
                          )
                        : "Select Field In File"
                      : tr("Select Field In File")}
                  </option>
                  {importedFileFields?.map((field) => (
                    <option value={field} key={field}>
                      {field}
                    </option>
                  ))}
                </Select>
              </GridItem>
            </>
          ))}
        </Grid>

        <Flex Flex justifyContent={"end"} mt="5">
          <Button size="sm" onClick={() => handleSubmit()} variant="brand"><LocalizedText text="Save" /></Button>
        </Flex>
      </Card>
    </>
  );
}

export default withLocalization(OpportunityprojectImport);
