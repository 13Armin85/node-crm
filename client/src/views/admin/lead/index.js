import useRecordRefresh from "utils/useRecordRefresh";
import LeadOwner from "./components/LeadOwner";
import ConvertLeadButtons from "./components/ConvertLeadButtons";
import RecordMenuButton from "components/table/RecordMenuButton";
import { Portal } from '@chakra-ui/react';
import { isAdmin } from 'roles';
import { LocalizedText, tr, withLocalization } from 'i18n/runtime';
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { HasAccess } from "../../../redux/accessUtils";
import {
  Grid,
  GridItem,
  Text,
  Menu,
  MenuItem,
  MenuList,
  useDisclosure,
  Select,
} from "@chakra-ui/react";
import {
  DeleteIcon,
  ViewIcon,
  EditIcon,
  EmailIcon,
  PhoneIcon,
} from "@chakra-ui/icons";
import { getApi } from "services/api";
import CommonCheckTable from "../../../components/reactTable/checktable";
import Add from "./Add";
import Edit from "./Edit";
import AddEmailHistory from "views/admin/emailHistory/components/AddEmail";
import AddPhoneCall from "views/admin/phoneCall/components/AddPhoneCall";
import ImportModal from "./components/ImportModal";
import { putApi } from "services/api";
import CommonDeleteModel from "components/commonDeleteModel";
import { deleteManyApi } from "services/api";
import {
  getSearchData,
  setGetTagValues,
} from "../../../redux/slices/advanceSearchSlice";
import { useDispatch, useSelector } from "react-redux";
import { fetchLeadData } from "../../../redux/slices/leadSlice";
import { fetchLeadCustomFiled } from "../../../redux/slices/leadCustomFiledSlice";
import { toast } from "react-toastify";
import View from "./View";
import { useFormDefinition } from "utils/managedForm";

const Index = () => {
  const title = "Leads";
  const { definition } = useFormDefinition("Leads");
  const statuses = definition?.fields.find(field => field.name === "leadStatus")?.options || [
    { value: "active", label: "Active" }, { value: "pending", label: "Pending" },
    { value: "contacted", label: "Contacted" }, { value: "qualified", label: "Qualified" },
    { value: "viewing", label: "Property Viewing" }, { value: "negotiating", label: "Negotiating" },
    { value: "lost", label: "Lost" },
  ];
  const size = "lg";
  const user = JSON.parse(localStorage.getItem("user"));
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const [permission, emailAccess, callAccess] = HasAccess([
    "Leads",
    "Emails",
    "Calls",
  ]);
  const [isLoding, setIsLoding] = useState(false);
  const [searchDisplay, setSearchDisplay] = useState(false);
  // const [data, setData] = useState([]);
  const [tableColumns, setTableColumns] = useState([]);
  const [columns, setColumns] = useState([]);
  const [dataColumn, setDataColumn] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [action, setAction] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [leadData, setLeadData] = useState([]);
  const [edit, setEdit] = useState(false);
  const [deleteModel, setDelete] = useState(false);
  const [addPhoneCall, setAddPhoneCall] = useState(false);
  const [callSelectedId, setCallSelectedId] = useState();
  const [addEmailHistory, setAddEmailHistory] = useState(false);
  const [selectedId, setSelectedId] = useState();
  const [selectedValues, setSelectedValues] = useState([]);
  const [isImport, setIsImport] = useState(false);
  const [emailRec, setEmailRec] = useState("");
  const [phoneRec, setPhoneRec] = useState({});

  const data = useSelector((state) => state?.leadData?.data);
  useRecordRefresh(() => dispatch(fetchLeadData()));
  const leadStatusValue = (status) =>
    status && typeof status === "object"
      ? status.value || status.key || status.code || ""
      : status || "";

  const searchedDataOut = useSelector(
    (state) => state?.advanceSearchData?.searchResult
  );
  const payload = {
    leadStatus: location?.state,
  };

  const fetchData = async () => {
    setIsLoding(true);
    let result = await getApi(
      "api/lead/"
    );
    // setData(result?.data);
    setIsLoding(false);
  };

  const handleOpenEmail = (id, dataLead) => {
    if (id) {
      setEmailRec(dataLead?.leadEmail);
      setAddEmailHistory(true);
    }
  };

  const setStatusData = async (cell, e) => {
    try {
      setIsLoding(true);
      let response = await putApi(
        `api/lead/changeStatus/${cell?.original?._id}`,
        { leadStatus: e?.target?.value }
      );
      if (response?.status === 200) {
        setAction((pre) => !pre);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setIsLoding(false);
    }
  };

  const changeStatus = (cell) => {
    switch (leadStatusValue(cell?.original?.leadStatus)) {
      case "pending":
        return "pending";
      case "active":
        return "completed";
      case "lost":
        return "onHold";
      case "contacted":
      case "qualified":
      case "viewing":
      case "negotiating":
        return "inProgress";
      default:
        return "completed";
    }
  };

  const fetchCustomDataFields = async () => {
    setIsLoding(true);

    try {
      const result = await dispatch(fetchLeadCustomFiled());
      if (result?.payload?.status === 200) {
        setLeadData(result?.payload?.data);
      } else {
        toast.error(tr("Failed to fetch data"), tr("error"));
      }

      const actionHeader = {
        Header: tr("Action"),
        accessor: "action",
        isSortable: false,
        center: true,
        cell: ({ row, i }) => (
          <Text as="div" fontSize="md" fontWeight="900" textAlign={"center"} display="flex" justifyContent="center" alignItems="center">
            <ConvertLeadButtons leadId={row.original._id} onConverted={() => { setSelectedValues([]); setAction(current => !current); }} />
            <Menu isLazy strategy="fixed" placement="bottom-end" preventOverflow>
              <RecordMenuButton />
              <Portal><MenuList
                minW={"fit-content"}
               zIndex="popover">
                {permission?.update && (
                  <MenuItem
                    py={2.5}
                    icon={<EditIcon fontSize={15} mb={1} />}
                    onClick={() => {
                      setEdit(true);
                      setSelectedId(row?.values?._id);
                    }}
                  ><LocalizedText text="Edit" /></MenuItem>
                )}
                {callAccess?.create && (
                  <MenuItem
                    py={2.5}
                    width={"165px"}
                    onClick={() => {
                      setPhoneRec(row?.original);
                      setAddPhoneCall(true);
                      setCallSelectedId(row?.values?._id);
                    }}
                    icon={<PhoneIcon fontSize={15} mb={1} />}
                  ><LocalizedText text="Create Call" /></MenuItem>
                )}
                {emailAccess?.create && (
                  <MenuItem
                    py={2.5}
                    width={"165px"}
                    onClick={() => {
                      handleOpenEmail(row?.values?._id, row?.original);
                      setSelectedId(row?.values?._id);
                    }}
                    icon={<EmailIcon fontSize={15} mb={1} />}
                  ><LocalizedText text="Email Send" />{" "}
                  </MenuItem>
                )}
                {permission?.view && (
                  <MenuItem
                    py={2.5}
                    color={"green"}
                    icon={<ViewIcon mb={1} fontSize={15} />}
                    onClick={() => {
                      navigate(`/leadView/${row?.values?._id}`, {
                        state: { leadList: data },
                      });
                    }}
                  ><LocalizedText text="View" /></MenuItem>
                )}
                {permission?.delete && (
                  <MenuItem
                    py={2.5}
                    color={"red"}
                    icon={<DeleteIcon fontSize={15} mb={1} />}
                    onClick={() => {
                      setDelete(true);
                      setSelectedValues([row?.values?._id]);
                    }}
                  ><LocalizedText text="Delete" /></MenuItem>
                )}
              </MenuList></Portal>
            </Menu>
          </Text>
        ),
      };
      const tempTableColumns = [
        { Header: tr("#"), accessor: "_id", isSortable: false, width: 10 },
        {
          Header: tr("Status"),
          accessor: "leadStatus",
          isSortable: true,
          center: true,
          cell: ({ row }) => (
            <div className="selectOpt">
              <Select
                className={changeStatus(row)}
                onChange={(e) => setStatusData(row, e)}
                height={7}
                width={130}
                value={leadStatusValue(row?.original?.leadStatus)}
                style={{ fontSize: "14px" }}
              >
                {statuses.map(status => <option key={status.value} value={status.value}>{tr(status.label)}</option>)}
              </Select>
            </div>
          ),
        },
        ...(result?.payload?.data && result?.payload?.data?.length > 0
          ? result?.payload?.data[0]?.fields
              ?.filter((field) => field?.isTableField === true && field?.isView)
              ?.map(
                (field) =>
                  field?.name !== "leadStatus" && {
                    Header: field?.label,
                    accessor: field?.name,
                    cell: (cell) => (
                      <div className="selectOpt">
                        <Text
                          onClick={() => {
                            navigate(`/leadView/${cell?.row?.original?._id}`);
                          }}
                          me="10px"
                          sx={{
                            "&:hover": {
                              color: "blue.500",
                              textDecoration: "underline",
                            },
                            cursor: "pointer",
                          }}
                          color="brand.600"
                          fontSize="sm"
                          fontWeight="700"
                        >
                          {cell?.value || "-"}
                        </Text>
                        {field.name === "leadName" && <LeadOwner lead={cell.row.original} />}
                      </div>
                    ),
                  }
              ) || []
          : []),
        ...(result?.payload?.data && result?.payload?.data?.length > 0
          ? result?.payload?.data[0]?.fields
              ?.filter(
                (field) =>
                  field?.isTableField === true &&
                  !field?.isView &&
                  field?.name !== "leadStatus"
              )
              ?.map((field) => ({
                Header: field?.label,
                accessor: field?.name,
                ...(field.name === 'leadName' ? { cell: ({ row }) => <><Text>{row.original.leadName || '-'}</Text><LeadOwner lead={row.original} /></> } : {}),
              })) || []
          : []),
        ...(permission?.update || permission?.view || permission?.delete
          ? [actionHeader]
          : []),
      ];

      setColumns(tempTableColumns || []);
      setIsLoding(false);
    } catch (error) {
      console?.error("Error fetching custom data fields:", error);
      toast.error(tr("Failed to fetch data "), tr("error"));
    }
  };

  const handleDeleteLead = async (ids) => {
    try {
      setIsLoding(true);
      let response = await deleteManyApi("api/lead/deleteMany", ids);
      if (response?.status === 200) {
        setSelectedValues([]);
        setDelete(false);
        setAction((pre) => !pre);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoding(false);
    }
  };

  useEffect(() => {
    if (window?.location?.pathname === "/lead") {
      dispatch(fetchLeadData());
    }
    fetchCustomDataFields();
  }, [action, definition]);

  useEffect(() => {
    setDataColumn(
      tableColumns?.filter((item) =>
        selectedColumns?.find((colum) => colum?.Header === item?.Header)
      )
    );
  }, [tableColumns, selectedColumns]);

  useEffect(() => {
    if (location?.state) {
      setSearchDisplay(true);
      dispatch(
        getSearchData({ values: payload, allData: data, type: "Leads" })
      );
      const getValue = [
        {
          name: ["leadStatus"],
          value: location?.state,
        },
      ];
      dispatch(setGetTagValues(getValue?.filter((item) => item?.value)));
    }
  }, [data, location?.state]);

  return (
    <div>
      <Grid templateColumns="repeat(6, 1fr)" mb={3} gap={4}>
        {!isLoding && (
          <GridItem colSpan={6}>
            <CommonCheckTable
              preservePage
              onImported={() => setAction(current => !current)}
              compact
              title={title}
              isLoding={isLoding}
              searchDisplay={searchDisplay}
              setSearchDisplay={setSearchDisplay}
              columnData={columns ?? []}
              // dataColumn={dataColumn ?? []}
              allData={data ?? []}
              tableData={searchDisplay ? searchedDataOut : data}
              tableCustomFields={
                leadData?.[0]?.fields?.filter(
                  (field) => field?.isTableField === true
                ) || []
              }
              access={permission}
              action={action}
              setAction={setAction}
              // selectedColumns={selectedColumns}
              // setSelectedColumns={setSelectedColumns}
              isOpen={isOpen}
              onClose={onclose}
              onOpen={onOpen}
              selectedValues={selectedValues}
              setSelectedValues={setSelectedValues}
              setDelete={setDelete}
              setIsImport={setIsImport}
            />
          </GridItem>
        )}
      </Grid>
      {isOpen && (
        <Add
          isOpen={isOpen}
          size={size}
          leadData={leadData[0]}
          onClose={onClose}
          setAction={setAction}
          action={action}
        />
      )}
      {edit && (
        <Edit
          isOpen={edit}
          size={size}
          leadData={leadData[0]}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          onClose={setEdit}
          setAction={setAction}
          moduleId={leadData?.[0]?._id}
        />
      )}
      {deleteModel && (
        <CommonDeleteModel
          isOpen={deleteModel}
          onClose={() => setDelete(false)}
          type="Leads"
          handleDeleteData={handleDeleteLead}
          ids={selectedValues}
        />
      )}
      {addEmailHistory && (
        <AddEmailHistory
          fetchData={fetchData}
          isOpen={addEmailHistory}
          onClose={setAddEmailHistory}
          lead={true}
          id={selectedId}
          leadEmail={emailRec}
        />
      )}
      {addPhoneCall && (
        <AddPhoneCall
          fetchData={fetchData}
          isOpen={addPhoneCall}
          onClose={setAddPhoneCall}
          lead={true}
          id={callSelectedId}
          LData={phoneRec}
        />
      )}
      {isImport && (
        <ImportModal
          text="Lead file"
          isOpen={isImport}
          onClose={setIsImport}
          customFields={leadData?.[0]?.fields || []}
        />
      )}
    </div>
  );
};

export default withLocalization(Index);
