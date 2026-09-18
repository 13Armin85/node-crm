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

  return actions.map(() => ['admin', 'user'].includes(user?.role) ? permission : {});
};
