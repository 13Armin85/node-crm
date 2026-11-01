// Apply the shared settings surfaces to the hub and every settings destination.
export const isSettingsPage = (pathname = '') =>
  /^\/(admin-setting|audit-logs|data-visibility|form-builder|custom-fields|change-images|validations|table-field|active-deactive-module|module|user|userview)(\/|$)/i.test(pathname);
