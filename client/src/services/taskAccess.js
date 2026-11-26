import { isAdmin } from 'roles';
import { getStoredUser } from './authSession';

const idOf = value => String(value?._id || value || '');

// Administrators manage every task; ordinary users manage only personal tasks
// they created for themselves (not delegated or generated lead-call tasks).
export const canManageTask = (task, user = getStoredUser()) => {
  if (!task || !user) return false;
  if (isAdmin(user)) return true;
  const me = idOf(user);
  return !!me && idOf(task.createBy) === me && idOf(task.assignedToUser) === me && !task.leadCallFor;
};
