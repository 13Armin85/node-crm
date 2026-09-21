// Values coming from populated API relations and legacy form definitions are
// sometimes objects. Native inputs/options must receive primitive values.
export const formValue = (value) => {
  if (value == null || value === "undefined" || value === "[object Object]") return "";
  if (typeof value !== "object") return value;
  for (const key of ["value", "_id", "id", "status", "key", "code", "label", "name", "title"]) {
    if (value[key] != null && typeof value[key] !== "object") return formValue(value[key]);
  }
  return "";
};

export const formLabel = (value, fallback = "") => {
  if (value == null) return fallback;
  if (typeof value !== "object") {
    const text = String(value)
      .replace(/\[object Object\]|\b(?:undefined|null)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text || fallback;
  }
  const fullName = [value.firstName, value.lastName].filter(part => typeof part === "string" && part.trim()).join(" ");
  if (fullName) return fullName;
  for (const key of ["companyName", "fullName", "name", "title", "username", "leadName", "label", "text", "value"]) {
    if (value[key] != null && value[key] !== value) {
      const label = formLabel(value[key]);
      if (label) return label;
    }
  }
  return fallback;
};
