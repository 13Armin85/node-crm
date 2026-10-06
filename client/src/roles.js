export const ROLE_PATH = {
  user: "/user",
  admin: "/admin",
  developer: "/admin",
};

export const ROLE = {
  admin: "admin",
  developer: "developer",
  user: "user",
};

export const isDeveloper = (user) => user?.role === ROLE.developer;
export const isAdmin = (user) => isDeveloper(user) || user?.role === ROLE.admin;
export const canEditUser = (actor, target) => Boolean(actor && target) && (
  isDeveloper(actor) || (isAdmin(actor) && !isDeveloper(target)) || actor._id === target._id
);
export const canDeleteUser = (actor, target) => Boolean(actor && target) && actor._id !== target._id
  && (isDeveloper(actor) || (actor.role === ROLE.admin && target.role === ROLE.user));
