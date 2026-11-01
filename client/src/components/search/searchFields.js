import { formLabel, formValue } from 'utils/formValue';

export const SYSTEM_DATE_FIELDS = [
  { name: "createdDate", label: "Created Date", type: "date", options: [] },
  { name: "updatedDate", label: "Updated Date", type: "date", options: [] },
];

export const normalizeSearchFields = (fields = [], rows = []) => {
  const normalized = (fields || [])
    .filter((field) => field?.name)
    .map((field) => {
      const systemDate = SYSTEM_DATE_FIELDS.find(
        (item) => item.name === field.name,
      );
      if (systemDate) return { ...field, ...systemDate };
      if (field.type !== 'select' || !(field.ref || field.relation)) return field;
      // Relationship metadata contains legacy example options. The loaded
      // records supply the real labels and IDs that this filter can match.
      const options = new Map();
      for (const row of rows || []) {
        const value = field.name.split('.').reduce((item, key) => item?.[key], row);
        for (const record of Array.isArray(value) ? value : [value]) {
          if (!record || typeof record !== 'object') continue;
          const id = formValue(record), label = formLabel(record);
          if (id && label) options.set(String(id), { value: String(id), label });
        }
      }
      return { ...field, options: [...options.values()].sort((a, b) => a.label.localeCompare(b.label)) };
    });

  SYSTEM_DATE_FIELDS.forEach((field) => {
    const exists = normalized.some((item) => item.name === field.name);
    if (!exists) normalized.push(field);
  });

  return normalized;
};

export const optionText = (option) =>
  option?.label ?? option?.name ?? option?.title ?? option?.value ?? "";
export const matchesSelectValue = (value, selected) => !selected ||
  (Array.isArray(value) ? value : [value]).some(item => String(formValue(item)) === String(formValue(selected)));
