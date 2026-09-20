import { LocalizedText, tr, withLocalization } from 'i18n/runtime';
import { useEffect, useState } from "react";
import { DeleteIcon, EditIcon, ViewIcon } from "@chakra-ui/icons";
import {
  Button,
  ButtonGroup,
  Badge,
  Flex,
  Box,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Select,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { getApi } from "services/api";
import { HasAccess } from "../../../redux/accessUtils";
import CommonCheckTable from "../../../components/reactTable/checktable";
import TaskAdvanceSearch from "./components/TaskAdvanceSearch";
import { SearchIcon } from "@chakra-ui/icons";
import { CiMenuKebab } from "react-icons/ci";
import ImportModal from "../lead/components/ImportModal";
import { putApi } from "services/api";
import { useLocation } from "react-router-dom";
import CommonDeleteModel from "components/commonDeleteModel";
import { deleteManyApi } from "services/api";
import AddEdit from "./components/AddEdit";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { fetchTaskData } from "../../../redux/slices/taskSlice";
import { toast } from "react-toastify";
import { FiColumns, FiList, FiPlus } from "react-icons/fi";
import TaskKanban from "./components/TaskKanban";

const selectionValue = (value) => {
  if (!value || typeof value !== "object") return value || "";
  return value._id || value.id || value.value || value.status || value.key || "";
};

const taskStatus = (value) => {
  const status = String(selectionValue(value) || "todo");
  return ["todo", "inProgress", "pending", "onHold", "completed"].includes(status)
    ? status
    : "todo";
};

const taskPriority = (task) => {
  const priority = String(selectionValue(task?.priority || task?.customFields?.priority) || "normal").toLowerCase();
  return ["low", "normal", "high", "urgent"].includes(priority) ? priority : "normal";
};

const normalizeTaskRecord = (task) => ({
  ...task,
  category: selectionValue(task?.category) || "None",
  status: taskStatus(task?.status),
  priority: taskPriority(task),
  assignTo: selectionValue(task?.assignTo),
  assignToLead: selectionValue(task?.assignToLead),
  assignedToUser: selectionValue(task?.assignedToUser),
  createBy: selectionValue(task?.createBy),
});

const Task = () => {
  const [action, setAction] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedId, setSelectedId] = useState();
  const [selectedValues, setSelectedValues] = useState([]);
  const [advanceSearch, setAdvanceSearch] = useState(false);
  const [getTagValuesOutSide, setGetTagValuesOutside] = useState([]);
  const [searchboxOutside, setSearchboxOutside] = useState("");
  const user = JSON.parse(localStorage.getItem("user"));
  const [deleteMany, setDeleteMany] = useState(false);
  const [isImportLead, setIsImportLead] = useState(false);
  const [isLoding, setIsLoding] = useState(false);
  const [data, setData] = useState([]);
  const [displaySearchData, setDisplaySearchData] = useState(false);
  const [searchedData, setSearchedData] = useState([]);
  const [userAction, setUserAction] = useState("");
  const [viewMode, setViewMode] = useState("kanban");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [assignees, setAssignees] = useState([]);
  const [permission] = HasAccess(["Tasks"]);
  const location = useLocation();
  const state = location?.state;
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleEditOpen = (row) => {
    onOpen();
    setUserAction("edit");
    setSelectedId(row?.values?._id);
  };
  const actionHeader = {
    Header: tr("Action"),
    isSortable: false,
    center: true,
    cell: ({ row }) => (
      <Text fontSize="md" fontWeight="900" textAlign={"center"}>
        <Menu isLazy>
          <MenuButton>
            <CiMenuKebab />
          </MenuButton>
          <MenuList
            minW={"fit-content"}
            transform={"translate(1520px, 173px);"}
          >
            {(permission?.update || user?.role !== "admin") && (
              <MenuItem
                py={2.5}
                icon={<EditIcon fontSize={15} mb={1} />}
                onClick={() => handleEditOpen(row)}
              ><LocalizedText text="Edit" /></MenuItem>
            )}
            {permission?.view && (
              <MenuItem
                py={2.5}
                color={"green"}
                icon={<ViewIcon mb={1} fontSize={15} />}
                onClick={() => {
                  handleViewOpen(row?.values?._id);
                }}
              ><LocalizedText text="View" /></MenuItem>
            )}
            {permission?.delete && (
              <MenuItem
                py={2.5}
                color={"red"}
                icon={<DeleteIcon fontSize={15} mb={1} />}
                onClick={() => {
                  setDeleteMany(true);
                  setSelectedValues([row?.values?._id]);
                }}
              ><LocalizedText text="Delete" /></MenuItem>
            )}
          </MenuList>
        </Menu>
      </Text>
    ),
  };
  const tableColumns = [
    {
      Header: tr("#"),
      accessor: "_id",
      isSortable: false,
      width: 5,
    },
    {
      Header: tr("Title"),
      accessor: "title",
      type: "text",
      formikType: "",
      cell: (cell) => (
        <div className="selectOpt">
          <Text
            onClick={() => handleViewOpen(cell?.row?.original?._id)}
            me="10px"
            sx={{
              "&:hover": { color: "blue.500", textDecoration: "underline" },
              cursor: "pointer",
            }}
            color="brand.600"
            fontSize="sm"
            fontWeight="700"
          >
            {cell?.value}
          </Text>
        </div>
      ),
    },
    {
      Header: tr("Related"),
      accessor: "category",
      type: "text",
      formikType: "",
      cell: ({ value }) => <LocalizedText text={selectionValue(value) || "None"} />,
    },
    {
      Header: tr("Status"),
      accessor: "status",
      type: "select",
      formikType: "",
      cell: (cell) => (
        <div className="selectOpt">
          <Select
            data-task-select="status"
            className={changeStatus(cell)}
            onChange={(e) => setStatusData(cell, e)}
            height={7}
            width={130}
            value={taskStatus(cell?.value)}
            style={{ fontSize: "14px" }}
          >
            <option value="todo" label={tr("Todo")}>{tr("Todo")}</option>
            <option value="inProgress" label={tr("In Progress")}>{tr("In Progress")}</option>
            <option value="pending" label={tr("Pending")}>{tr("Pending")}</option>
            <option value="onHold" label={tr("On Hold")}>{tr("On Hold")}</option>
            <option value="completed" label={tr("Completed")}>{tr("Completed")}</option>
          </Select>
        </div>
      ),
    },
    {
      Header: tr("Assign To"),
      accessor: "assignedToUserName",
      type: "text",
      formikType: "",
    },
    {
      Header: tr("Priority"),
      accessor: "priority",
      type: "text",
      formikType: "",
      cell: ({ row }) => {
        const priority = taskPriority(row.original);
        const schemes = { low: "green", normal: "blue", high: "orange", urgent: "red" };
        return <Badge colorScheme={schemes[priority]}><LocalizedText text={priority} /></Badge>;
      },
    },
    { Header: tr("Related"), accessor: "assignToName", type: "text", formikType: "" },
    { Header: tr("Start Date"), accessor: "start", type: "date", formikType: "" },
    { Header: tr("End Date"), accessor: "end", type: "date", formikType: "" },
    ...(permission?.update || user?.role !== "admin" || permission?.view || permission?.delete
      ? [actionHeader]
      : []),
  ];

  const fetchData = async () => {
    setIsLoding(true);
    const result = await dispatch(fetchTaskData());
    if (result?.payload?.status === 200) {
      setData((result?.payload?.data || []).map(normalizeTaskRecord));
    } else {
      toast.error(tr("Failed to fetch data"), tr("error"));
    }
    setIsLoding(false);
  };
  const setStatusData = async (cell, e) => {
    try {
      setIsLoding(true);
      let response = await putApi(
        `api/task/changeStatus/${cell?.row?.original?._id}`,
        { status: e?.target?.value },
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
  const updateKanbanStatus = async (taskId, status) => {
    const previous = data;
    setData((items) => items.map((item) => item._id === taskId ? { ...item, status } : item));
    const response = await putApi(`api/task/changeStatus/${taskId}`, { status });
    if (response?.status !== 200) {
      setData(previous);
      toast.error(tr("Failed to update task"));
    }
  };
  const delegateTask = async (taskId, assignedToUser) => {
    const response = await putApi(`api/task/edit/${taskId}`, { assignedToUser });
    if (response?.status === 200) {
      toast.success(tr("Task delegated successfully"));
      fetchData();
    } else toast.error(tr("Failed to delegate task"));
  };
  const changeStatus = (cell) => {
    switch (taskStatus(cell?.value)) {
      case "pending":
        return "pending";
      case "completed":
        return "completed";
      case "todo":
        return "toDo";
      case "onHold":
        return "onHold";
      case "inProgress":
        return "inProgress";
      default:
        return "";
    }
  };

  const handleDeleteTask = async (ids) => {
    try {
      setIsLoding(true);
      let response = await deleteManyApi("api/task/deleteMany", ids);
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

  const handleViewOpen = (id) => {
    navigate(`/view/${id}`);
  };

  const addBtn = () => {
    onOpen();
    setUserAction("add");
  };

  const handleClose = () => {
    onClose();
    setSelectedId("");
  };
  useEffect(() => {
    fetchData();
  }, [action]);

  useEffect(() => {
    getApi("api/task/assignees").then((result) => {
      if (result?.status === 200) setAssignees(result.data || []);
    });
  }, []);

  const visibleData = assigneeFilter === "all"
    ? data
    : data.filter((item) => String(selectionValue(item.assignedToUser) || selectionValue(item.createBy)) === assigneeFilter);

  return (
    <Box width="100%" minW={0}>
      <Flex mb={4} justify="space-between" align={{ base: "stretch", md: "center" }} direction={{ base: "column", md: "row" }} gap={3}>
        <Box>
          <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="900"><LocalizedText text="Task Management" /></Text>
          <Text color="gray.500" fontSize="sm"><LocalizedText text="Assign tasks to users and change work status with drag and drop." /></Text>
        </Box>
        <Flex gap={2} wrap="wrap" width={{ base: "100%", md: "auto" }}>
          {user?.role === "admin" && (
            <Select size="sm" w={{ base: "100%", sm: "190px" }} value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
              <option value="all">{tr("All users")}</option>
              {assignees.map((item) => <option key={item._id} value={item._id}>{[item.firstName, item.lastName].filter(Boolean).join(" ") || item.username}</option>)}
            </Select>
          )}
          <ButtonGroup size="sm" isAttached variant="outline" flex={{ base: "1 1 auto", sm: "initial" }}>
            <Button flex={{ base: 1, sm: "initial" }} leftIcon={<FiColumns />} colorScheme={viewMode === "kanban" ? "brand" : "gray"} onClick={() => setViewMode("kanban")}><LocalizedText text="Kanban" /></Button>
            <Button flex={{ base: 1, sm: "initial" }} leftIcon={<FiList />} colorScheme={viewMode === "list" ? "brand" : "gray"} onClick={() => setViewMode("list")}><LocalizedText text="List" /></Button>
          </ButtonGroup>
          {permission?.create && <Button flex={{ base: "1 1 auto", sm: "initial" }} size="sm" variant="brand" leftIcon={<FiPlus />} onClick={addBtn}><LocalizedText text="New Task" /></Button>}
        </Flex>
      </Flex>
      {viewMode === "kanban" ? (
        <TaskKanban tasks={visibleData} assignees={assignees} onDelegate={delegateTask} onStatusChange={updateKanbanStatus} onView={handleViewOpen} />
      ) : <CommonCheckTable
        title={tr("Tasks")}
        isLoding={isLoding}
        columnData={tableColumns ?? []}
        // dataColumn={dataColumn ?? []}
        allData={visibleData ?? []}
        searchDisplay={displaySearchData}
        setSearchDisplay={setDisplaySearchData}
        searchedDataOut={searchedData}
        setSearchedDataOut={setSearchedData}
        tableCustomFields={[]}
        access={permission}
        // selectedColumns={selectedColumns}
        // setSelectedColumns={setSelectedColumns}
        state={state}
        onOpen={addBtn}
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
        handleSearchType="TasksSearch"
      />}

      <TaskAdvanceSearch
        advanceSearch={advanceSearch}
        setAdvanceSearch={setAdvanceSearch}
        state={state}
        setSearchedData={setSearchedData}
        setDisplaySearchData={setDisplaySearchData}
        allData={data ?? []}
        setAction={setAction}
        setGetTagValues={setGetTagValuesOutside}
        setSearchbox={setSearchboxOutside}
      />
      <AddEdit
        isOpen={isOpen}
        fetchData={fetchData}
        onClose={handleClose}
        userAction={userAction}
        id={selectedId}
        setAction={setAction}
      />
      <CommonDeleteModel
        isOpen={deleteMany}
        onClose={() => setDeleteMany(false)}
        type="Tasks"
        handleDeleteData={handleDeleteTask}
        ids={selectedValues}
      />
      <ImportModal
        text="Lead file"
        fetchData={fetchData}
        isOpen={isImportLead}
        onClose={setIsImportLead}
      />
    </Box>
  );
};

export default withLocalization(Task);
