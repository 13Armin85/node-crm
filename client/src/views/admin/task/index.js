import useRecordRefresh from "utils/useRecordRefresh";
import { isAdmin } from 'roles';
import { canManageTask } from 'services/taskAccess';
import { LocalizedText, tr, withLocalization } from 'i18n/runtime';
import { lazy, Suspense, useEffect, useState } from "react";
import { Button, Flex, Box, Spinner, useDisclosure } from "@chakra-ui/react";
import { getApi, putApi } from "services/api";
import { HasAccess } from "../../../redux/accessUtils";
import TaskAgenda from "./components/TaskAgenda";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { fetchTaskData } from "../../../redux/slices/taskSlice";
import { toast } from "react-toastify";
import { FiPlus } from "react-icons/fi";

const AddEdit = lazy(() => import('./components/AddEdit'));

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

export const normalizeTaskRecord = (task) => ({
  ...task,
  category: selectionValue(task?.category) || "None",
  status: taskStatus(task?.status),
  priority: taskPriority(task),
  assignTo: selectionValue(task?.assignTo),
  assignToLead: selectionValue(task?.assignToLead),
  assignedToUser: selectionValue(task?.assignedToUser),
  createBy: selectionValue(task?.createBy),
});

// Tasks are shown as an agenda grouped by due time; selecting a task opens its full details.
const Task = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [user] = useState(() => JSON.parse(localStorage.getItem("user")));
  const [isLoding, setIsLoding] = useState(true);
  const [data, setData] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [action, setAction] = useState(false);
  const [permission] = HasAccess(["Tasks"]);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const admin = isAdmin(user);

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
  useRecordRefresh(async () => {
    const result = await getApi('api/task');
    if (result?.status === 200) setData((result.data || []).map(normalizeTaskRecord));
  });

  const changeStatus = async (taskId, status) => {
    if (!canManageTask(data.find(task => task._id === taskId), user)) return;
    const previous = data;
    setData(items => items.map(item => item._id === taskId ? { ...item, status, updatedDate: new Date().toISOString() } : item));
    const response = await putApi(`api/task/changeStatus/${taskId}`, { status });
    if (response?.status !== 200) {
      setData(previous);
      toast.error(tr("Failed to update task"));
    }
  };

  useEffect(() => { fetchData(); }, [action]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!admin) return;
    getApi("api/task/assignees").then((result) => {
      if (result?.status === 200) setAssignees(result.data || []);
    });
  }, [admin]);

  return (
    <Box width="100%" minW={0}>
      {isLoding && !data.length ? (
        <Flex justify="center" py={10}><Spinner /></Flex>
      ) : (
        <TaskAgenda
          title={tr("Task Management")}
          subtitle={tr("taskAgenda.subtitle")}
          actions={permission?.create && <Button size="md" variant="brand" leftIcon={<FiPlus />} onClick={onOpen}><LocalizedText text="New Task" /></Button>}
          tasks={data}
          user={user}
          isAdmin={admin}
          assignees={assignees}
          onOpen={id => navigate(`/view/${id}`)}
          onStatusChange={changeStatus}
        />
      )}
      {isOpen && <Suspense fallback={<Spinner />}><AddEdit
        isOpen={isOpen}
        fetchData={fetchData}
        onClose={onClose}
        userAction="add"
        setAction={setAction}
      /></Suspense>}
    </Box>
  );
};

export default withLocalization(Task);
