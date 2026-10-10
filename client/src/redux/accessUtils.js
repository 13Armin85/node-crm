import { isAdmin, isDeveloper } from 'roles';
import { canViewModule } from 'services/moduleVisibility';

export const HasAccess = (actions) => {
  const user = JSON.parse(localStorage.getItem("user"));
  const permission = {
    create: true,
    update: true,
    delete: true,
    view: true,
    import: true,
    export: true,
  };

  const adminModules = ['Users', 'Roles', 'Custom Fields', 'Active Deactive Module'];
  return actions.map(title => {
    if (!isAdmin(user) && user?.role !== 'user') return {};
    if (!canViewModule(title, user)) return {};
    if (!isAdmin(user) && (adminModules.includes(title) || ['Tasks', 'Task', 'Completed Tasks'].includes(title))) return { view: true, export: true };
    return title === 'Users' ? { ...permission, create: isDeveloper(user) } : permission;
  });
};
