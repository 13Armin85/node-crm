const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { differences, sanitize } = require("../services/auditLog");
const { buildFilter } = require("../controllers/auditLog");
test("audit differences include nested values, array changes, empty objects and removals", () => {
  const changes = differences(
    {
      nested: { small: 0 },
      list: ["old", "removed"],
      empty: "text",
      deleted: false,
    },
    { nested: { small: 1 }, list: ["new"], empty: {}, deleted: true },
  );
  assert(
    changes.some(
      (row) =>
        row.field === "nested.small" && row.before === 0 && row.after === 1,
    ),
  );
  assert(
    changes.some(
      (row) =>
        row.field === "list.1" &&
        row.before === "removed" &&
        row.after === null,
    ),
  );
  assert(
    changes.some(
      (row) =>
        row.field === "empty" &&
        row.before === "text" &&
        JSON.stringify(row.after) === "{}",
    ),
  );
  assert(changes.some((row) => row.field === "deleted" && row.after === true));
  assert.deepEqual(differences({ title: "same" }, { title: "same" }), []);
});
test("audit records signal credential changes without retaining old or new secrets", () => {
  const changes = differences(
    { password: "old-hash", config: { apiKey: "old-key" } },
    { password: "new-hash", config: { apiKey: "new-key" } },
  );
  assert.equal(changes.length, 2);
  for (const change of changes)
    assert.deepEqual(
      [change.before, change.after],
      ["[REDACTED]", "[REDACTED]"],
    );
  const safe = sanitize({
    nested: [{ accessToken: "raw-token", name: "visible" }],
    id: new mongoose.Types.ObjectId(),
    date: new Date("2026-01-01"),
  });
  assert.equal(safe.nested[0].accessToken, "[REDACTED]");
  assert.equal(safe.nested[0].name, "visible");
  assert.equal(typeof safe.id, "string");
  assert.equal(safe.date, "2026-01-01T00:00:00.000Z");
});
test("audit API always limits ordinary users to the authenticated actor, even with forged filters", () => {
  const id = new mongoose.Types.ObjectId(),
    other = String(new mongoose.Types.ObjectId());
  assert.equal(
    buildFilter({ _id: id, role: "user" }, { actorId: other }).actorId,
    id,
  );
  assert.equal(
    buildFilter({ _id: id, role: "admin" }, { actorId: other }).actorId,
    other,
  );
  assert.deepEqual(buildFilter({ _id: id, role: "developer" }, {}), {});
  assert.throws(() => buildFilter({ role: "admin" }, { actorId: "bad" }));
  assert.throws(() => buildFilter({ role: "admin" }, { from: "invalid" }));
  assert.throws(() => buildFilter({ role: "user" }, { action: "invalid" }));
  assert.throws(() => buildFilter({ role: "user" }, { q: { $ne: "" } }));
  const filter = buildFilter({ role: "user", _id: id }, { q: "[x].*" });
  assert(filter.$or[0].actorName.test("user [x].*"));
  assert(!filter.$or[0].actorName.test("user xAAAA"));
});

test("primary section summaries collapse side effects and describe bulk imports", () => {
  const { summarize } = require("../services/auditLog");
  const actor = {
    _id: new mongoose.Types.ObjectId(),
    firstName: "Tester",
    role: "admin",
  };
  const store = {
    req: { actor, method: "POST", originalUrl: "/api/import/Contacts" },
    entries: new Map([
      [
        "side-effect",
        {
          entityCollection: "User",
          recordId: "counter",
          recordLabel: "Counter",
          action: "update",
        },
      ],
      [
        "one",
        {
          entityCollection: "Contacts",
          recordId: "one",
          recordLabel: "One",
          action: "create",
        },
      ],
      [
        "two",
        {
          entityCollection: "Contacts",
          recordId: "two",
          recordLabel: "Two",
          action: "create",
        },
      ],
    ]),
  };
  const summary = summarize(store);
  assert.equal(summary.entityCollection, "Contacts");
  assert.equal(summary.operation, "import");
  assert.equal(summary.recordCount, 2);
  assert.equal(summary.action, "create");
  assert.deepEqual(summary.changes, []);
  assert.equal(summary.recordId, undefined);
});

test("a confirmed file deletion is described as deletion even when its parent folder is updated", () => {
  const { summarize } = require("../services/auditLog");
  const summary = summarize({
    req: {
      actor: { _id: new mongoose.Types.ObjectId() },
      method: "DELETE",
      originalUrl: "/api/document/delete/file-id",
    },
    entries: new Map([
      [
        "folder",
        {
          entityCollection: "Document",
          recordId: "folder",
          recordLabel: "Folder",
          action: "update",
        },
      ],
    ]),
  });
  assert.equal(summary.action, "delete");
  assert.equal(summary.operation, "delete");
});
