import { Badge, Box, Flex, Select, SimpleGrid, Text, useColorModeValue } from "@chakra-ui/react";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { FiCalendar, FiUser } from "react-icons/fi";

const columns = [
  { id: "todo", title: "برای انجام", color: "gray" },
  { id: "inProgress", title: "در حال انجام", color: "blue" },
  { id: "pending", title: "در انتظار", color: "orange" },
  { id: "onHold", title: "متوقف", color: "purple" },
  { id: "completed", title: "انجام‌شده", color: "green" },
];

const TaskKanban = ({ tasks = [], assignees = [], onDelegate, onStatusChange, onView }) => {
  const columnBg = useColorModeValue("gray.50", "navy.800");
  const cardBg = useColorModeValue("white", "navy.700");
  const borderColor = useColorModeValue("gray.200", "whiteAlpha.200");

  const onDragEnd = ({ destination, source, draggableId }) => {
    if (!destination || destination.droppableId === source.droppableId) return;
    onStatusChange(draggableId, destination.droppableId);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Box overflowX="auto" pb={3}>
        <SimpleGrid columns={5} spacing={4} minW="1180px" alignItems="start">
          {columns.map((column) => {
            const items = tasks.filter((task) => (task.status || "todo") === column.id);
            return (
              <Box key={column.id} bg={columnBg} borderRadius="18px" p={3} border="1px solid" borderColor={borderColor}>
                <Flex justify="space-between" align="center" mb={3} px={1}>
                  <Flex align="center" gap={2}>
                    <Box w="9px" h="9px" borderRadius="full" bg={`${column.color}.400`} />
                    <Text fontWeight="800" fontSize="sm">{column.title}</Text>
                  </Flex>
                  <Badge borderRadius="full" colorScheme={column.color}>{items.length}</Badge>
                </Flex>
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      minH="420px"
                      borderRadius="14px"
                      bg={snapshot.isDraggingOver ? `${column.color}.50` : "transparent"}
                      transition="background .2s ease"
                    >
                      {items.map((task, index) => (
                        <Draggable draggableId={task._id} index={index} key={task._id}>
                          {(dragProvided, dragSnapshot) => (
                            <Box
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              bg={cardBg}
                              border="1px solid"
                              borderColor={dragSnapshot.isDragging ? `${column.color}.300` : borderColor}
                              boxShadow={dragSnapshot.isDragging ? "xl" : "sm"}
                              borderRadius="14px"
                              p={3.5}
                              mb={3}
                              cursor="grab"
                              onDoubleClick={() => onView(task._id)}
                            >
                              <Text fontWeight="800" fontSize="sm" noOfLines={2} mb={2}>{task.title}</Text>
                              {task.description && <Text color="gray.500" fontSize="xs" noOfLines={2} mb={3}>{task.description}</Text>}
                              <Flex direction="column" gap={1.5} color="gray.500" fontSize="xs">
                                <Flex align="center" gap={1.5}><FiUser />{task.assignedToUserName || "بدون مسئول"}</Flex>
                                {(task.end || task.start) && <Flex align="center" gap={1.5}><FiCalendar />{task.end || task.start}</Flex>}
                              </Flex>
                              <Select
                                mt={3}
                                size="xs"
                                borderRadius="8px"
                                value={task.assignedToUser || task.createBy || ""}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => onDelegate(task._id, event.target.value)}
                              >
                                {assignees.map((item) => (
                                  <option key={item._id} value={item._id}>{[item.firstName, item.lastName].filter(Boolean).join(" ") || item.username}</option>
                                ))}
                              </Select>
                              {task.category && task.category !== "None" && (
                                <Badge mt={3} colorScheme="brand" variant="subtle" borderRadius="full">{task.assignToName || task.category}</Badge>
                              )}
                            </Box>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </Box>
                  )}
                </Droppable>
              </Box>
            );
          })}
        </SimpleGrid>
      </Box>
    </DragDropContext>
  );
};

export default TaskKanban;
