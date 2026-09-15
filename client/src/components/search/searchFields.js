export const SYSTEM_DATE_FIELDS = [
  { name: "createdDate", label: "Created Date", type: "date", options: [] },
  { name: "updatedDate", label: "Updated Date", type: "date", options: [] },
];

export const normalizeSearchFields = (fields = []) => {
  const normalized = (fields || [])
    .filter((field) => field?.name)
    .map((field) => {
      const systemDate = SYSTEM_DATE_FIELDS.find(
        (item) => item.name === field.name,
      );
      return systemDate ? { ...field, ...systemDate } : field;
    });

  SYSTEM_DATE_FIELDS.forEach((field) => {
    const exists = normalized.some((item) => item.name === field.name);
    if (!exists) normalized.push(field);
  });

  return normalized;
};

export const optionText = (option) =>
  option?.label ?? option?.name ?? option?.title ?? option?.value ?? "";
