import {
  Badge,
  Box,
  Flex,
  Select,
  SimpleGrid,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { useLanguage } from "i18n";
import { FiCalendar, FiUser } from "react-icons/fi";
import { createPortal } from "react-dom";

const columns = [
  { id: "todo", title: "Todo", color: "gray" },
  { id: "inProgress", title: "In Progress", color: "blue" },
  { id: "pending", title: "Pending", color: "orange" },
  { id: "onHold", title: "On Hold", color: "purple" },
  { id: "completed", title: "Completed", color: "green" },
];

const objectValue = (value) => {
  if (!value || typeof value !== "object") return value || "";
  return value._id || value.id || value.value || value.status || value.key || "";
};

const taskStatus = (task) => {
  const status = String(objectValue(task?.status) || "todo");
  return columns.some((column) => column.id === status) ? status : "todo";
};

const taskPriority = (task) => {
  const priority = String(objectValue(task?.priority || task?.customFields?.priority) || "normal").toLowerCase();
  return ["low", "normal", "high", "urgent"].includes(priority) ? priority : "normal";
};

const TaskKanban = ({ tasks = [], assignees = [], onDelegate, onStatusChange, onView }) => {
  const { t } = useLanguage();
  const columnBg = useColorModeValue("gray.50", "#0f1727");
  const borderColor = useColorModeValue("gray.200", "whiteAlpha.200");
  const dragOverBg = useColorModeValue("blackAlpha.50", "whiteAlpha.100");
  const cardText = useColorModeValue("gray.800", "gray.50");
  const mutedText = useColorModeValue("gray.500", "gray.300");
  const priorityStyles = useColorModeValue(
    {
      low: { bg: "green.50", border: "green.300", scheme: "green" },
      normal: { bg: "blue.50", border: "blue.300", scheme: "blue" },
      high: { bg: "orange.50", border: "orange.300", scheme: "orange" },
      urgent: { bg: "red.50", border: "red.300", scheme: "red" },
    },
    {
      low: { bg: "#112a27", border: "green.400", scheme: "green" },
      normal: { bg: "#142940", border: "blue.400", scheme: "blue" },
      high: { bg: "#332616", border: "orange.400", scheme: "orange" },
      urgent: { bg: "#351c25", border: "red.400", scheme: "red" },
    },
  );

  const onDragEnd = ({ destination, source, draggableId }) => {
    document.body.classList.remove("crm-kanban-is-dragging");
    if (!destination || destination.droppableId === source.droppableId) return;
    onStatusChange(draggableId, destination.droppableId);
  };

  const onDragStart = () => {
    document.body.classList.add("crm-kanban-is-dragging");
  };

  return (
    <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <SimpleGrid
        className="crm-kanban-board"
        columns={{ base: 1, sm: 2, xl: 5 }}
        spacing={{ base: 3, md: 4 }}
        alignItems="start"
        width="100%"
      >
        {columns.map((column) => {
          const items = tasks.filter((task) => taskStatus(task) === column.id);
          return (
            <Box
              key={column.id}
              bg={columnBg}
              borderRadius={{ base: "14px", md: "18px" }}
              p={{ base: 2.5, md: 3 }}
              border="1px solid"
              borderColor={borderColor}
              minW={0}
            >
              <Flex justify="space-between" align="center" mb={3} px={1}>
                <Flex align="center" gap={2} minW={0}>
                  <Box w="9px" h="9px" flexShrink={0} borderRadius="full" bg={`${column.color}.400`} />
                  <Text fontWeight="800" fontSize="sm" noOfLines={1}>{t(column.title)}</Text>
                </Flex>
                <Badge borderRadius="full" colorScheme={column.color}>{items.length}</Badge>
              </Flex>
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <Box
                    className={`crm-kanban-dropzone${snapshot.isDraggingOver ? " is-over" : ""}`}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    minH={{ base: items.length ? "80px" : "120px", md: "260px" }}
                    borderRadius="14px"
                    bg={snapshot.isDraggingOver ? dragOverBg : "transparent"}
                    transition="background-color .18s ease, box-shadow .18s ease"
                  >
                    {items.map((task, index) => {
                      const priority = taskPriority(task);
                      const priorityStyle = priorityStyles[priority];
                      return (
                        <Draggable draggableId={String(task._id)} index={index} key={task._id}>
                          {(dragProvided, dragSnapshot) => {
                            const card = (
                              <Box
                                className={`crm-kanban-card${dragSnapshot.isDragging ? " is-dragging" : ""}`}
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                bg={priorityStyle.bg}
                                color={cardText}
                                border="1px solid"
                                borderInlineStartWidth="4px"
                                borderColor={dragSnapshot.isDragging ? `${column.color}.400` : priorityStyle.border}
                                boxShadow={dragSnapshot.isDragging ? "0 24px 60px rgba(0, 0, 0, .32)" : "sm"}
                                borderRadius="14px"
                                p={3.5}
                                mb={3}
                                cursor={dragSnapshot.isDragging ? "grabbing" : "grab"}
                                minW={0}
                                onDoubleClick={() => onView(task._id)}
                              >
                                <Flex align="start" justify="space-between" gap={2} mb={2}>
                                  <Text fontWeight="800" fontSize="sm" noOfLines={2} minW={0}>{task.title}</Text>
                                  <Badge flexShrink={0} colorScheme={priorityStyle.scheme}>{t(priority)}</Badge>
                                </Flex>
                                {task.description && <Text color={mutedText} fontSize="xs" noOfLines={2} mb={3}>{task.description}</Text>}
                                <Flex direction="column" gap={1.5} color={mutedText} fontSize="xs">
                                  <Flex align="center" gap={1.5} minW={0}><FiUser /><Text noOfLines={1}>{task.assignedToUserName || t("Unassigned")}</Text></Flex>
                                  {(task.end || task.start) && <Flex align="center" gap={1.5}><FiCalendar /><Text noOfLines={1}>{task.end || task.start}</Text></Flex>}
                                </Flex>
                                <Select
                                  mt={3}
                                  size="xs"
                                  borderRadius="8px"
                                  aria-label={t("Assigned User")}
                                  value={String(objectValue(task.assignedToUser) || objectValue(task.createBy) || "")}
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => onDelegate(task._id, event.target.value)}
                                >
                                  {assignees.map((item) => (
                                    <option key={item._id} value={item._id}>
                                      {[item.firstName, item.lastName].filter(Boolean).join(" ") || item.username}
                                    </option>
                                  ))}
                                </Select>
                                {task.category && task.category !== "None" && (
                                  <Badge mt={3} colorScheme="brand" variant="subtle" borderRadius="full">
                                    {task.assignToName || t(objectValue(task.category))}
                                  </Badge>
                                )}
                              </Box>
                            );

                            return dragSnapshot.isDragging && typeof document !== "undefined"
                              ? createPortal(card, document.body)
                              : card;
                          }}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </Box>
                )}
              </Droppable>
            </Box>
          );
        })}
      </SimpleGrid>
    </DragDropContext>
  );
};

export default TaskKanban;
