import RecordMenuButton from "components/table/RecordMenuButton";
import { Portal } from '@chakra-ui/react';
import { LocalizedText, tr, withLocalization } from 'i18n/runtime';
import { useEffect, useState } from "react";
import { DeleteIcon, ViewIcon, EditIcon } from "@chakra-ui/icons";
import {
  Button,
  Menu,
  MenuItem,
  MenuList,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { getApi } from "services/api";
import { HasAccess } from "../../../redux/accessUtils";
import CommonCheckTable from "../../../components/reactTable/checktable";
import { SearchIcon } from "@chakra-ui/icons";
import { Link, useNavigate } from "react-router-dom";
import MeetingAdvanceSearch from "./components/MeetingAdvanceSearch";
import AddMeeting from "./components/Addmeeting";
import CommonDeleteModel from "components/commonDeleteModel";
import { deleteManyApi } from "services/api";
import { toast } from "react-toastify";
import { fetchMeetingData } from "../../../redux/slices/meetingSlice";
import { useDispatch } from "react-redux";

const Index = () => {
  const title = "Meeting";
  const navigate = useNavigate();
  const [editId, setEditId] = useState(null);
  const [action, setAction] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedValues, setSelectedValues] = useState([]);
  const [advanceSearch, setAdvanceSearch] = useState(false);
  const [getTagValuesOutSide, setGetTagValuesOutside] = useState([]);
  const [searchboxOutside, setSearchboxOutside] = useState("");
  const user = JSON.parse(localStorage.getItem("user"));
  const [deleteMany, setDeleteMany] = useState(false);
  const [isLoding, setIsLoding] = useState(false);
  const [data, setData] = useState([]);
  const [displaySearchData, setDisplaySearchData] = useState(false);
  const [searchedData, setSearchedData] = useState([]);
  const [permission] = HasAccess(["Meetings"]);
  const dispatch = useDispatch();

  const actionHeader = {
    Header: tr("Action"),
    isSortable: false,
    center: true,
    cell: ({ row }) => (
      <Text fontSize="md" fontWeight="900" textAlign={"center"}>
        <Menu isLazy strategy="fixed" placement="bottom-end" preventOverflow>
          <RecordMenuButton />
          <Portal><MenuList
            minW={"fit-content"}
           zIndex="popover">
            {permission?.update && <MenuItem icon={<EditIcon />} onClick={() => { setEditId(row.original._id); onOpen(); }}><LocalizedText text="Edit" /></MenuItem>}
            {permission?.view && (
              <MenuItem
                py={2.5}
                color={"green"}
                onClick={() => navigate(`/metting/${row?.values?._id}`)}
                icon={<ViewIcon fontSize={15} />}
              ><LocalizedText text="View" /></MenuItem>
            )}
            {permission?.delete && (
              <MenuItem
                py={2.5}
                color={"red"}
                onClick={() => {
                  setDeleteMany(true);
                  setSelectedValues([row?.values?._id]);
                }}
                icon={<DeleteIcon fontSize={15} />}
              ><LocalizedText text="Delete" /></MenuItem>
            )}
          </MenuList></Portal>
        </Menu>
      </Text>
    ),
  };
  const tableColumns = [
    {
      Header: tr("#"),
      accessor: "_id",
      isSortable: false,
      width: 10,
    },
    {
      Header: tr("Agenda"),
      accessor: "agenda",
      cell: (cell) => (
        <Link to={`/metting/${cell?.row?.values?._id}`}>
          {" "}
          <Text
            me="10px"
            sx={{
              "&:hover": { color: "blue.500", textDecoration: "underline" },
            }}
            color="brand.600"
            fontSize="sm"
            fontWeight="700"
          >
            {cell?.value || " - "}
          </Text>
        </Link>
      ),
    },
    { Header: tr("Date & Time"), accessor: "dateTime" },
    { Header: tr("Time Stamp"), accessor: "timestamp" },
    { Header: tr("Create By"), accessor: "createdByName" },
    ...(permission?.update || permission?.view || permission?.delete
      ? [actionHeader]
      : []),
  ];

  const fetchData = async () => {
    setIsLoding(true);
    const result = await dispatch(fetchMeetingData());
    if (result?.payload?.status === 200) {
      setData(result?.payload?.data);
    } else {
      toast.error(tr("Failed to fetch data"), tr("error"));
    }
    setIsLoding(false);
  };

  const handleDeleteMeeting = async (ids) => {
    try {
      setIsLoding(true);
      let response = await deleteManyApi("api/meeting/deleteMany", ids);
      if (response?.status === 200) {
        setSelectedValues([]);
        setDeleteMany(false);
        setAction((pre) => !pre);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoding(false);
    }
  };

  // const [selectedColumns, setSelectedColumns] = useState([...tableColumns]);
  // const dataColumn = tableColumns?.filter(item => selectedColumns?.find(colum => colum?.Header === item.Header))

  useEffect(() => {
    fetchData();
  }, [action]);

  return (
    <div>
      <CommonCheckTable
        title={title}
        isLoding={isLoding}
        columnData={tableColumns ?? []}
        // dataColumn={dataColumn ?? []}
        allData={data ?? []}
        tableData={data}
        searchDisplay={displaySearchData}
        setSearchDisplay={setDisplaySearchData}
        searchedDataOut={searchedData}
        setSearchedDataOut={setSearchedData}
        tableCustomFields={[]}
        access={permission}
        // action={action}
        // setAction={setAction}
        // selectedColumns={selectedColumns}
        // setSelectedColumns={setSelectedColumns}
        // isOpen={isOpen}
        // onClose={onClose}
        onOpen={() => { setEditId(null); onOpen(); }}
        selectedValues={selectedValues}
        setSelectedValues={setSelectedValues}
        setDelete={setDeleteMany}
        AdvanceSearch={
          <Button
            variant="outline"
            colorScheme="brand"
            leftIcon={<SearchIcon />}
            mt={{ sm: "5px", md: "0" }}
            size="sm"
            onClick={() => setAdvanceSearch(true)}
          ><LocalizedText text="Advance Search" /></Button>
        }
        getTagValuesOutSide={getTagValuesOutSide}
        searchboxOutside={searchboxOutside}
        setGetTagValuesOutside={setGetTagValuesOutside}
        setSearchboxOutside={setSearchboxOutside}
        handleSearchType="MeetingSearch"
      />

      <MeetingAdvanceSearch
        advanceSearch={advanceSearch}
        setAdvanceSearch={setAdvanceSearch}
        setSearchedData={setSearchedData}
        setDisplaySearchData={setDisplaySearchData}
        allData={data ?? []}
        setAction={setAction}
        setGetTagValues={setGetTagValuesOutside}
        setSearchbox={setSearchboxOutside}
      />
      <AddMeeting editId={editId} setAction={setAction} isOpen={isOpen} onClose={onClose} />

      {/* Delete model */}
      <CommonDeleteModel
        isOpen={deleteMany}
        onClose={() => setDeleteMany(false)}
        type="Meetings"
        handleDeleteData={handleDeleteMeeting}
        ids={selectedValues}
      />
    </div>
  );
};

export default withLocalization(Index);
