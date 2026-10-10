import { isAdmin } from 'roles';
import { getStoredUser } from './authSession';
export const canManageTask = (task, user = getStoredUser()) => !!task && isAdmin(user);
