import { matchesSearch } from 'utils/searchText';

export const userDisplayName = user => [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || '';
export const matchesAssignee = (user, query) => matchesSearch([userDisplayName(user), user?.username], query);
export const matchesTaskSearch = (task, query) => matchesSearch([
  task.title, task.description, task.notes, task.category,
  task.assignedToUserName, task.assignToName, task.createByName,
], query);

export const matchesTaskFilters = (task, filters = {}) =>
  ['title', 'category', 'status', 'start', 'end'].every(field => matchesSearch([task[field]], filters[field])) &&
  matchesSearch([task.assignToName, task.assignedToUserName], filters.assignToName) &&
  (!filters.assignedToUserName || matchesSearch([task.assignedToUserName], filters.assignedToUserName)) &&
  (filters.fromLeadScore === undefined || filters.fromLeadScore === '' || filters.fromLeadScore === null || Number(task.leadScore) >= Number(filters.fromLeadScore)) &&
  (filters.toLeadScore === undefined || filters.toLeadScore === '' || filters.toLeadScore === null || Number(task.leadScore) <= Number(filters.toLeadScore));

export const filterTasks = (tasks, query = '', filters = {}) =>
  tasks.filter(task => matchesTaskFilters(task, filters) && matchesTaskSearch(task, query));
