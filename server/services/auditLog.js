const { AsyncLocalStorage } = require("node:async_hooks");
const { randomUUID } = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const mongoose = require("mongoose");
const context = new AsyncLocalStorage();
const REDACTED = "[REDACTED]";
const sensitive = (field) =>
  /password|passwd|secret|token|authorization|credential|api[_-]?key|authVersion/i.test(
    field,
  );
const plain = (value) => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (value?._bsontype === "ObjectId") return String(value);
  if (Buffer.isBuffer(value)) return "[binary]";
  return value;
};
function sanitize(value, field = "") {
  if (sensitive(field)) return REDACTED;
  value = plain(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item, field));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sanitize(item, field ? field + "." + key : key),
      ]),
    );
  return value;
}
function differences(before, after, prefix = "") {
  if (isDeepStrictEqual(before, after)) return [];
  if (sensitive(prefix))
    return [
      {
        field: prefix,
        before: before == null ? null : REDACTED,
        after: after == null ? null : REDACTED,
      },
    ];
  const traversable = (value) =>
    value &&
    typeof value === "object" &&
    !(value instanceof Date) &&
    !value._bsontype &&
    !Buffer.isBuffer(value);
  if (traversable(before) || traversable(after)) {
    const keys = new Set([
      ...Object.keys(traversable(before) ? before : {}),
      ...Object.keys(traversable(after) ? after : {}),
    ]);
    if (
      keys.size &&
      (before == null || traversable(before)) &&
      (after == null || traversable(after)) &&
      (!before || !after || Array.isArray(before) === Array.isArray(after))
    )
      return [...keys].flatMap((key) =>
        differences(
          before?.[key],
          after?.[key],
          prefix ? prefix + "." + key : key,
        ),
      );
  }
  return [
    {
      field: prefix,
      before: sanitize(before, prefix),
      after: sanitize(after, prefix),
    },
  ];
}
function envelope(req) {
  const actor = req.actor;
  return {
    actorId: actor._id,
    actorName: [actor.firstName, actor.lastName].filter(Boolean).join(" "),
    actorUsername: actor.username,
    actorRole: actor.role,
    requestId: context.getStore()?.requestId,
    method: req.method,
    path: String(req.originalUrl || "").split("?")[0],
    createdAt: new Date(),
  };
}
async function persist(connection, entries) {
  // Use the underlying driver to avoid recording the audit trail itself.
  for (let start = 0; start < entries.length; start += 100) {
    await connection.db
      .collection("AuditLog")
      .insertMany(entries.slice(start, start + 100));
  }
}
const ignoredCollections = new Set([
  "AuditLog",
  "Notification",
  "Notifications",
  "uploadlocks",
  "AuthSession",
  "AuthSessions",
]);
const canonical = (name) =>
  require("./moduleVisibility").canonicalModule(
    { formdefinitions: "FormDefinition", estatefiles: "EstateFile" }[name] ||
      name,
  );
function primaryModule(req) {
  const parts = String(req.originalUrl || "")
    .split("?")[0]
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
  const route = parts[1];
  if (req.readModuleName) return canonical(req.readModuleName);
  if (route === "estate")
    return parts[2] === "definitions"
      ? "FormDefinition"
      : parts[2] === "files"
        ? "EstateFile"
        : canonical(parts[2]);
  if (route === "import") return canonical(parts[2]);
  return canonical(
    {
      user: "Users",
      visibility: "Users",
      contact: "Contacts",
      lead: "Leads",
      task: "Tasks",
      property: "Properties",
      document: "Documents",
      "record-sharing": "RecordShares",
      "custom-field": "CustomField",
      form: req.readModuleName,
      phoneCall: "Calls",
      "text-msg": "Texts",
      meeting: "Meetings",
      email: "Emails",
      "email-temp": "Email Template",
      opportunity: "Opportunities",
      invoices: "Invoices",
      quotes: "Quotes",
      images: "Images",
      validation: "Validation",
      modules: "ModuleActiveDeactive",
      route: "Route",
      "bank-details": "Bank Details",
      opportunityproject: "Opportunity Project",
    }[route] || "",
  );
}
function operationFor(req, action) {
  const path = String(req.originalUrl || "").split("?")[0];
  if (/\/user\/change-password$/.test(path)) return "password";
  if (/^\/api\/visibility\//.test(path)) return "access";
  if (/^\/api\/record-sharing(?:\/|$)/.test(path))
    return action === "delete" ? "unshare" : "share";
  if (/^\/api\/import\//.test(path)) return "import";
  if (/\/move\//.test(path)) return "move";
  if (
    /^\/api\/(?:custom-field|validation|modules|route)(?:\/|$)|^\/api\/estate\/definitions\//.test(
      path,
    )
  )
    return "settings";
  return action;
}
function queue(store, connection, entry) {
  const key = entry.entityCollection + ":" + (entry.recordId || "collection");
  const previous = store.entries.get(key);
  if (previous?.action === "create" && entry.action === "delete") {
    store.entries.delete(key);
    return;
  }
  if (previous?.action === "create" && entry.action === "update")
    entry.action = "create";
  store.entries.set(key, { ...entry, connection });
}
function summarize(store) {
  if (store.explicit)
    return { ...store.explicit, schemaVersion: 2, recordCount: 1, changes: [] };
  const all = [...store.entries.values()];
  if (!all.length) return null;
  const preferred = primaryModule(store.req);
  const matched = all.filter(
    (entry) => canonical(entry.entityCollection) === preferred,
  );
  const chosen = matched.length
    ? matched
    : all.filter((entry) => entry.entityCollection === all[0].entityCollection);
  const actions = new Set(chosen.map((entry) => entry.action));
  const deleting =
    store.req.method === "DELETE" ||
    /\/deleteMany(?:\/|$)/i.test(store.req.originalUrl || "");
  const action = deleting
    ? "delete"
    : actions.size === 1
      ? chosen[0].action
      : "update";
  const first = chosen[0];
  return {
    ...envelope(store.req),
    schemaVersion: 2,
    action,
    operation: operationFor(store.req, action),
    entityCollection: first.entityCollection,
    recordCount: chosen.length,
    recordId: chosen.length === 1 ? first.recordId : undefined,
    recordLabel: chosen.length === 1 ? first.recordLabel : "",
    changes: [],
  };
}
async function recordEvent(req, action) {
  const store = context.getStore();
  if (!store?.enabled || !req.actor?._id) return;
  store.explicit = {
    ...envelope(req),
    action,
    operation: action,
    entityCollection: "User",
    recordId: String(req.actor._id),
  };
}
function install() {
  const prototype = mongoose.Collection.prototype;
  if (prototype.crmAuditInstalled) return;
  Object.defineProperty(prototype, "crmAuditInstalled", { value: true });
  const methods = [
    "insertOne",
    "insertMany",
    "updateOne",
    "updateMany",
    "replaceOne",
    "findOneAndUpdate",
    "findOneAndReplace",
    "deleteOne",
    "deleteMany",
    "findOneAndDelete",
    "bulkWrite",
    "rename",
  ];
  for (const method of methods) {
    const original = prototype[method];
    if (typeof original !== "function") continue;
    prototype[method] = function (...args) {
      const store = context.getStore();
      const req = store?.req;
      if (
        !store?.enabled ||
        !req?.actor?._id ||
        ignoredCollections.has(this.name)
      )
        return original.apply(this, args);
      // Mongoose bulkWrite uses a callback. Complete auditing before resolving it.
      const callback =
        typeof args[args.length - 1] === "function" ? args.pop() : null;
      const run = async () => {
        const collectionName = this.name;
        if (method === "rename") {
          const result = await original.apply(this, args);
          queue(store, this.conn, {
            action: "rename",
            entityCollection: collectionName,
            recordLabel: String(args[0] || collectionName),
          });
          return result;
        }
        const before = new Map(),
          ids = new Map();
        const options =
          args[
            method === "bulkWrite" ||
            method.startsWith("insert") ||
            method.startsWith("delete") ||
            method === "findOneAndDelete"
              ? 1
              : 2
          ] || {};
        const readOptions = options.session ? { session: options.session } : {};
        const remember = (row) => {
          if (row?._id != null) ids.set(String(row._id), row._id);
        };
        const snapshot = async (filter, many, sort) => {
          let cursor = this.find(filter, readOptions);
          if (sort) cursor = cursor.sort(sort);
          if (!many) cursor = cursor.limit(1);
          for (const row of await cursor.toArray()) {
            before.set(String(row._id), row);
            remember(row);
          }
        };
        if (method.startsWith("insert")) {
          for (const row of method === "insertOne" ? [args[0]] : args[0])
            remember(row);
        } else if (method === "bulkWrite") {
          for (const operation of args[0]) {
            for (const [kind, spec] of Object.entries(operation)) {
              if (kind === "insertOne") remember(spec.document);
              else if (spec.filter)
                await snapshot(spec.filter, kind.endsWith("Many"), spec.sort);
            }
          }
        } else await snapshot(args[0], method.endsWith("Many"), options.sort);
        let result, writeError;
        try {
          result = await original.apply(this, args);
        } catch (error) {
          writeError = error;
          result = error.result;
        }
        // Include upserts as well as inserts and records whose filter changed during an update.
        const upserted = result?.upsertedId;
        if (upserted) remember({ _id: upserted._id || upserted });
        for (const id of Object.values(result?.upsertedIds || {}))
          remember({ _id: id });
        for (const id of Object.values(result?.insertedIds || {}))
          remember({ _id: id });
        if (result?.insertedId) remember({ _id: result.insertedId });
        const after = new Map();
        if (ids.size)
          for (const row of await this.find(
            { _id: { $in: [...ids.values()] } },
            readOptions,
          ).toArray())
            after.set(String(row._id), row);
        const entries = [];
        for (const id of ids.keys()) {
          const oldRow = before.get(id),
            newRow = after.get(id);
          const changes = differences(oldRow, newRow).filter(
            (change) =>
              change.field !== "__v" &&
              !change.field.startsWith("_duplicateKeys"),
          );
          if (!changes.length) continue;
          const row = newRow || oldRow;
          const label =
            row.title ||
            row.leadName ||
            row.opportunityName ||
            row.invoiceNumber ||
            row.quoteNumber ||
            row.folderName ||
            row.fileName ||
            row.name ||
            row.subject ||
            row.agenda ||
            row.fullName ||
            row.companyName ||
            [row.firstName, row.lastName].filter(Boolean).join(" ") ||
            row.username ||
            row.moduleName ||
            "";
          entries.push({
            ...envelope(req),
            action: !oldRow
              ? "create"
              : !newRow || (!oldRow.deleted && newRow.deleted === true)
                ? "delete"
                : "update",
            entityCollection: collectionName,
            recordId: id,
            recordLabel: typeof label === "string" ? label.slice(0, 500) : "",
          });
        }
        if (!writeError)
          for (const entry of entries) queue(store, this.conn, entry);
        if (writeError) throw writeError;
        return result;
      };
      const pending = run();
      if (callback) {
        pending.then(
          (result) => callback(null, result),
          (error) => callback(error),
        );
        return;
      }
      return pending;
    };
  }
}
function middleware(req, res, next) {
  const enabled =
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
    !/^\/api\/(?:notification|reporting|audit-logs)(?:\/|$)/.test(
      req.originalUrl || "",
    );
  const store = {
    req,
    enabled,
    requestId: randomUUID(),
    entries: new Map(),
    explicit: null,
  };
  const end = res.end;
  let ending = false;
  res.end = function (...args) {
    if (ending || !enabled) return end.apply(this, args);
    ending = true;
    // Persist one summary only after the controller has confirmed a successful save.
    const entry =
      res.statusCode >= 200 && res.statusCode < 300 ? summarize(store) : null;
    if (!entry) return end.apply(this, args);
    const connection =
      [...store.entries.values()][0]?.connection || mongoose.connection;
    persist(connection, [entry])
      .then(() => end.apply(this, args))
      .catch((error) => {
        console.error("Audit summary could not be saved:", error.name);
        if (!res.headersSent) {
          res.statusCode = 503;
          res.removeHeader("Content-Length");
          res.removeHeader("ETag");
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          end.call(res, JSON.stringify({ code: "serverError" }));
        } else res.destroy(error);
      });
    return this;
  };
  context.run(store, next);
}
module.exports = {
  install,
  middleware,
  differences,
  sanitize,
  recordEvent,
  summarize,
  ignoredCollections,
};
