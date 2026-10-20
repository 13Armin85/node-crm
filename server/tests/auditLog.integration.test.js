const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { jwtSecret } = require("../config/auth");

test(
  "audit capture covers mutations, isolates users and preserves login across profile edits",
  { skip: process.env.AUDIT_INTEGRATION !== "1" },
  async (t) => {
    const dbName = "crm_audit_test_" + crypto.randomUUID().replace(/-/g, "");
    await mongoose.connect("mongodb://127.0.0.1:27017", {
      dbName,
      serverSelectionTimeoutMS: 5000,
    });
    let server;
    t.after(async () => {
      if (server) await new Promise((resolve) => server.close(resolve));
      assert.equal(mongoose.connection.name, dbName);
      assert(dbName.startsWith("crm_audit_test_"));
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });
    t.mock.method(
      require("../middelwares/mail"),
      "sendEmail",
      async () => null,
    );
    const app = express();
    app.use(express.json());
    app.use("/api", require("../controllers/route"));
    const User = require("../model/schema/user"),
      Log = require("../model/schema/auditLog");
    const Record = mongoose.model(
      "AuditTest",
      new mongoose.Schema({
        title: String,
        nested: mongoose.Schema.Types.Mixed,
        list: [String],
        deleted: Boolean,
        password: String,
      }),
      "AuditTest",
    );
    const auth = require("../middelwares/auth");
    app.post("/api/audit-test", auth, async (req, res, next) => {
      try {
        const { operation, id, values } = req.body;
        if (operation === "create") await Record.create(values);
        if (operation === "insertMany") await Record.insertMany(values);
        if (operation === "update")
          await Record.updateOne({ _id: id }, { $set: values });
        if (operation === "updateMany")
          await Record.updateMany({}, { $set: values });
        if (operation === "raw")
          await Record.collection.updateOne(
            { _id: new mongoose.Types.ObjectId(id) },
            { $set: values },
          );
        if (operation === "findOneAndUpdate")
          await Record.findOneAndUpdate({ _id: id }, { $set: values });
        if (operation === "bulkWrite")
          await Record.bulkWrite(
            values.map((operation) =>
              operation.updateOne
                ? {
                    updateOne: {
                      ...operation.updateOne,
                      update: { $set: operation.updateOne.update },
                    },
                  }
                : operation,
            ),
          );
        if (operation === "delete") await Record.findOneAndDelete({ _id: id });
        if (operation === "deleteMany") await Record.deleteMany({});
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    });
    app.use(require("../middelwares/securityHeaders").errorHandler);
    const password = "test-password-only";
    const hash = await bcrypt.hash(password, 10);
    const makeUser = (name, role) =>
      User.create({
        username: name + "@example.test",
        firstName: name,
        role,
        password: hash,
      });
    const admin = await makeUser("admin", "admin"),
      developer = await makeUser("developer", "developer"),
      user = await makeUser("ordinary", "user"),
      other = await makeUser("other", "user");
    await Log.init();
    server = await new Promise((resolve) => {
      const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    });
    const token = (actor) =>
      jwt.sign({ userId: actor._id, sv: actor.authVersion || 0 }, jwtSecret, {
        expiresIn: "5m",
      });
    const api = async (
      method,
      route,
      body,
      actor = user,
      extraHeaders = {},
    ) => {
      const response = await fetch(
        "http://127.0.0.1:" + server.address().port + "/api" + route,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(actor
              ? {
                  Authorization:
                    typeof actor === "string" ? actor : token(actor),
                }
              : {}),
            ...extraHeaders,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { status: response.status, data };
    };
    const mutate = (operation, values, id, actor = user) =>
      api("POST", "/audit-test", { operation, values, id }, actor);
    const logs = async (actor = admin, suffix = "") =>
      (await api("GET", "/audit-logs?limit=100&" + suffix, null, actor)).data;
    let record;
    await t.test(
      "create, nested edits, arrays, credentials and no-op writes",
      async () => {
        assert.equal(
          (
            await mutate("create", {
              title: "Initial [x].*",
              nested: { small: 1, secret: "hidden-secret" },
              list: ["old"],
              password: "hidden-password",
            })
          ).status,
          200,
        );
        record = await Record.findOne({ title: "Initial [x].*" });
        let list = await logs();
        assert.equal(list.total, 1);
        assert.equal(list.items[0].action, "create");
        assert.equal(String(list.items[0].actorId), String(user._id));
        assert.equal(
          (
            await mutate(
              "update",
              {
                title: "Changed",
                nested: { small: 2, secret: "changed-secret" },
                list: ["new"],
                password: "changed-password",
              },
              String(record._id),
            )
          ).status,
          200,
        );
        list = await logs();
        const update = list.items.find((row) => row.action === "update");
        assert(
          update.changes.some(
            (change) =>
              change.field === "nested.small" &&
              change.before === 1 &&
              change.after === 2,
          ),
        );
        assert(
          update.changes.some(
            (change) =>
              change.field === "list.0" &&
              change.before === "old" &&
              change.after === "new",
          ),
        );
        assert(
          update.changes.some(
            (change) =>
              change.field === "password" &&
              change.before === "[REDACTED]" &&
              change.after === "[REDACTED]",
          ),
        );
        assert(!JSON.stringify(list).includes("hidden-secret"));
        assert(!JSON.stringify(list).includes("hidden-password"));
        assert(!JSON.stringify(list).includes("changed-password"));
        const count = list.total;
        await mutate("update", { title: "Changed" }, String(record._id));
        assert.equal((await logs()).total, count);
      },
    );
    await t.test(
      "native collection updates, findOneAndUpdate, bulk writes, insertMany and updateMany",
      async () => {
        assert.equal(
          (
            await mutate(
              "raw",
              { title: "Raw update" },
              String(record._id),
              admin,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await mutate(
              "findOneAndUpdate",
              { title: "Find update" },
              String(record._id),
              admin,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await mutate(
              "insertMany",
              [{ title: "Batch A" }, { title: "Batch B" }],
              undefined,
              admin,
            )
          ).status,
          200,
        );
        let list = await logs();
        assert.equal(
          list.items.filter((row) => row.action === "create").length,
          3,
        );
        assert.equal(
          (
            await mutate(
              "updateMany",
              { "nested.bulk": true },
              undefined,
              admin,
            )
          ).status,
          200,
        );
        list = await logs();
        assert.equal(
          list.items.filter((row) =>
            row.changes.some((change) => change.field === "nested.bulk"),
          ).length,
          3,
        );
        const newId = String(new mongoose.Types.ObjectId());
        assert.equal(
          (
            await mutate(
              "bulkWrite",
              [
                {
                  updateOne: {
                    filter: { _id: String(record._id) },
                    update: { title: "Bulk update" },
                  },
                },
                { insertOne: { document: { title: "Bulk insert" } } },
                {
                  updateOne: {
                    filter: { _id: newId },
                    update: { title: "Upsert" },
                    upsert: true,
                  },
                },
              ],
              undefined,
              admin,
            )
          ).status,
          200,
        );
        list = await logs();
        assert(
          list.items.some(
            (row) => row.recordId === newId && row.action === "create",
          ),
        );
        assert(list.items.some((row) => row.recordLabel === "Bulk update"));
      },
    );
    await t.test(
      "own logs cannot be expanded by actor filters, data-scope headers or metadata",
      async () => {
        const own = await logs(user);
        for (const action of ["create", "update", "delete"])
          assert.equal(
            own.summary[action],
            own.items.filter((item) => item.action === action).length,
          );
        assert(own.items.length);
        assert(own.items.every((row) => row.actorId === String(user._id)));
        assert.deepEqual(own.actors, []);
        const forged = await logs(user, "actorId=" + admin._id);
        assert.equal(forged.total, own.total);
        assert(forged.items.every((row) => row.actorId === String(user._id)));
        const empty = await logs(other);
        assert.equal(empty.total, 0);
        assert.deepEqual(empty.summary, { create: 0, update: 0, delete: 0 });
        assert.deepEqual(empty.collections, []);
        assert.equal(
          (
            await api("GET", "/audit-logs", null, user, {
              "X-Crm-Data-User": String(admin._id),
            })
          ).status,
          403,
        );
        assert.equal((await api("GET", "/audit-logs", null, null)).status, 401);
        const all = await logs(admin);
        assert(all.total > own.total);
        assert.equal((await logs(developer)).total, all.total);
        const scoped = await logs(admin, "actorId=" + user._id);
        assert.equal(scoped.total, own.total);
        const paged = await api(
          "GET",
          "/audit-logs?limit=1&page=2",
          null,
          admin,
        );
        assert.equal(paged.data.items.length, 1);
        assert.equal(paged.data.total, all.total);
        assert.deepEqual(paged.data.summary, all.summary);
        assert.equal(
          (await api("GET", "/audit-logs?page=0", null, admin)).status,
          400,
        );
        assert.equal(
          (await api("GET", "/audit-logs?from=bad", null, admin)).status,
          400,
        );
        assert.equal(
          (await api("GET", "/audit-logs?actorId[$ne]=x", null, admin)).status,
          400,
        );
        assert.equal(
          (await api("DELETE", "/audit-logs/" + all.items[0]._id, null, admin))
            .status,
          404,
        );
        assert.equal(
          (await logs(admin, "action=create")).items.every(
            (row) => row.action === "create",
          ),
          true,
        );
        assert.equal(
          (await logs(admin, "q=" + encodeURIComponent("[x].*"))).total,
          1,
        );
        assert.equal((await logs(admin, "from=2099-01-01")).total, 0);
      },
    );
    await t.test(
      "generic module and import APIs cannot expose or modify the audit collection",
      async () => {
        const CustomField = require("../model/schema/customField");
        const metadata = await CustomField.create({
          moduleName: "AuditLog",
          fields: [],
        });
        const entry = (await logs()).items[0];
        for (const actor of [user, admin, developer]) {
          assert.equal(
            (await api("GET", "/form/?moduleId=" + metadata._id, null, actor))
              .status,
            404,
          );
          assert.equal(
            (
              await api(
                "PUT",
                "/form/edit/" + entry._id,
                { moduleId: String(metadata._id), actorName: "Forged" },
                actor,
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await api(
                "DELETE",
                "/form/delete/" + entry._id + "?moduleId=" + metadata._id,
                null,
                actor,
              )
            ).status,
            404,
          );
        }
        for (const moduleName of ["AuditLog", "AuditLogs"]) {
          assert.equal(
            (
              await api(
                "POST",
                "/custom-field/add-module",
                { moduleName },
                admin,
              )
            ).status,
            400,
          );
        }
      },
    );
    await t.test(
      "self name and username changes keep the existing token valid and return a safe updated profile",
      async () => {
        const existingToken = token(user);
        const edited = await api(
          "PUT",
          "/user/edit/" + user._id,
          {
            firstName: "Renamed",
            lastName: "Person",
            username: "renamed@example.test",
          },
          existingToken,
        );
        assert.equal(edited.status, 200);
        assert.equal(edited.data.user.firstName, "Renamed");
        assert.equal(edited.data.user.username, "renamed@example.test");
        assert(!edited.data.user.password);
        assert.equal(edited.data.user.authVersion, undefined);
        assert.equal(
          (await api("GET", "/user/view/" + user._id, null, existingToken))
            .status,
          200,
        );
        const stored = await User.findById(user._id).select("+authVersion");
        assert.equal(stored.authVersion, 0);
        const own = await logs(user);
        const edit = own.items.find(
          (row) => row.collection === "User" && row.action === "update",
        );
        assert(
          edit.changes.some(
            (change) =>
              change.field === "username" &&
              change.before === user.username &&
              change.after === "renamed@example.test",
          ),
        );
        const login = await api(
          "POST",
          "/user/login",
          { username: "renamed@example.test", password },
          null,
        );
        assert.equal(login.status, 200);
        assert.equal(
          (await api("POST", "/user/logout", {}, login.data.token)).status,
          200,
        );
        assert((await logs(user)).items.some((row) => row.action === "login"));
        assert((await logs(user)).items.some((row) => row.action === "logout"));
      },
    );
    await t.test(
      "deletion, soft deletion and deletes affecting many records retain before values",
      async () => {
        assert.equal(
          (await mutate("update", { deleted: true }, String(record._id), admin))
            .status,
          200,
        );
        let list = await logs();
        assert(
          list.items.some(
            (row) =>
              row.recordId === String(record._id) &&
              row.action === "delete" &&
              row.changes.some(
                (change) => change.field === "deleted" && change.after === true,
              ),
          ),
        );
        assert.equal(
          (await mutate("delete", null, String(record._id), admin)).status,
          200,
        );
        list = await logs();
        assert(
          list.items.some(
            (row) =>
              row.action === "delete" &&
              row.changes.some(
                (change) =>
                  change.field === "title" &&
                  change.before === "Bulk update" &&
                  change.after === null,
              ),
          ),
        );
        const remaining = await Record.countDocuments();
        await mutate("deleteMany", null, undefined, admin);
        assert.equal(await Record.countDocuments(), 0);
        assert.equal(
          (await logs()).items.filter((row) => row.action === "delete").length,
          remaining + 2,
        );
      },
    );
  },
);
