const sections = {
  formdefinitions: "estate.formBuilder",
  estatefiles: "Documents",
  User: "Users",
  Users: "Users",
  Contact: "Contacts",
  Lead: "Leads",
  Task: "Tasks",
  Document: "Documents",
  Property: "Properties",
  PartnerCustomers: "Partner Customers",
  PartnerCustomer: "Partner Customers",
  Residence: "Residences",
  Notification: "Notifications",
  RecordShare: "audit.sharing",
  RecordShares: "audit.sharing",
  FormDefinition: "estate.formBuilder",
  CustomField: "Custom Fields",
  Validation: "Validations",
  Images: "Images",
  EstateFile: "Documents",
  ModuleActiveDeactive: "Admin Settings",
  Route: "Admin Settings",
  EmailTemps: "Email Template",
  Email: "Emails",
  PhoneCall: "Calls",
  Meeting: "Meetings",
  MeetingHistory: "Meetings",
  TextMsg: "Texts",
  TextMsges: "Texts",
  BankDetails: "Bank Details",
  OpportunityProjects: "Opportunity Project",
  OpportunityProject: "Opportunity Project",
  Opportunities: "Opportunities",
  Opportunity: "Opportunities",
  Quotes: "Quotes",
  Invoices: "Invoices",
};
const kinds = {
  formdefinitions: "form",
  estatefiles: "document",
  User: "user",
  Users: "user",
  Contact: "contact",
  Contacts: "contact",
  Lead: "lead",
  Leads: "lead",
  Task: "task",
  Tasks: "task",
  Property: "property",
  Properties: "property",
  PartnerCustomers: "customer",
  "Partner Customers": "customer",
  PartnerCustomer: "customer",
  Residence: "residence",
  Residences: "residence",
  Document: "document",
  Documents: "document",
  EstateFile: "document",
  FormDefinition: "form",
  CustomField: "form",
  EmailTemps: "template",
  Email: "email",
  Emails: "email",
  PhoneCall: "call",
  Calls: "call",
  Meeting: "meeting",
  MeetingHistory: "meeting",
  Meetings: "meeting",
  Quotes: "quote",
  Invoices: "invoice",
  Opportunity: "opportunity",
  Opportunities: "opportunity",
};
const fill = (template, values) =>
  template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
export const auditSectionName = (collection, t) =>
  t(sections[collection] || collection || "audit.generalSection");
export function auditActivityText(item, t, language = "en") {
  const action = item.operation || item.action || "update";
  const actor = item.actorName || item.actorUsername || t("User");
  const section = auditSectionName(item.collection, t);
  const kind = t("audit.kind." + (kinds[item.collection] || "record"));
  const name =
    action === "settings" ? t(item.recordLabel || "") : item.recordLabel;
  const target = fill(t(name ? "audit.namedTarget" : "audit.unnamedTarget"), {
    kind,
    name,
  });
  const count = Math.max(1, Number(item.recordCount) || 1);
  const bulk = count > 1 && ["create", "update", "delete"].includes(action);
  return fill(t("audit.sentence." + action + (bulk ? "Many" : "")), {
    actor,
    target,
    section,
    count: count.toLocaleString(language),
  });
}
