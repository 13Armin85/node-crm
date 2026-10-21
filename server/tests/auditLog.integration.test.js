const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { jwtSecret } = require("../config/auth");
test(
  "confirmed activity summaries are readable, request-scoped and isolated by user",
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
    const auth = require("../middelwares/auth");
    const User = require("../model/schema/user"),
      Log = require("../model/schema/auditLog"),
      Notification = require("../model/schema/notification");
    const Record = mongoose.model(
      "AuditItems",
      new mongoose.Schema({
        title: String,
        internal: Number,
        nested: mongoose.Schema.Types.Mixed,
        deleted: Boolean,
      }),
      "AuditItems",
    );
    app.post("/api/audit-test", auth, async (req, res, next) => {
      try {
        req.readModuleName = "AuditItems";
        const { operation, id, values } = req.body;
        if (operation === "save") {
          await User.updateOne(
            { _id: req.actor._id },
            { $inc: { outboundcall: 1 } },
          );
          const row = await Record.create(values);
          await Record.updateOne(
            { _id: row._id },
            { $set: { title: "Final saved title" } },
          );
          await Notification.collection.insertOne({
            recipientId: req.actor._id,
            message: "automatic side effect",
          });
        }
        if (operation === "batch") await Record.insertMany(values);
        if (operation === "update")
          await Record.updateOne({ _id: id }, { $set: values });
        if (operation === "updateMany")
          await Record.updateMany({}, { $set: values });
        if (operation === "delete") await Record.deleteMany({});
        if (operation === "rejected") {
          await Record.updateOne(
            { _id: id },
            { $set: { title: "Rejected response" } },
          );
          return res.status(400).json({ code: "invalid" });
        }
        res.json({ saved: true });
      } catch (error) {
        next(error);
      }
    });
    app.get("/api/audit-background", auth, async (req, res, next) => {
      try {
        await Record.updateMany({}, { $inc: { internal: 1 } });
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    });
    app.use(require("../middelwares/securityHeaders").errorHandler);
    const password = "test-password-only",
      hash = await bcrypt.hash(password, 10);
    const makeUser = (name, role = "user") =>
      User.create({
        username: name + "@example.test",
        firstName: name,
        role,
        password: hash,
      });
    const admin = await makeUser("admin", "admin"),
      user = await makeUser("ordinary"),
      other = await makeUser("no-history"),
      developer = await makeUser("developer", "developer");
    await Log.init();
    server = await new Promise((resolve) => {
      const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    });
    const token = (actor) =>
      jwt.sign(
        { userId: actor._id, sv: Number(actor.authVersion || 0) },
        jwtSecret,
        { expiresIn: "5m" },
      );
    const api = async (method, route, body, actor = user, extra = {}) => {
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
            ...extra,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      return { status: response.status, data: await response.json() };
    };
    const mutate = (operation, values, id, actor = user) =>
      api("POST", "/audit-test", { operation, values, id }, actor);
    const logs = async (actor = admin, suffix = "") =>
      (await api("GET", "/audit-logs?limit=100&" + suffix, null, actor)).data;
    let record;
    await t.test(
      "one confirmed save produces one summary despite repeated writes, counters and notifications",
      async () => {
        assert.equal(
          (
            await mutate("save", {
              title: "Initial title",
              nested: { internalKey: "private-field-value" },
            })
          ).status,
          200,
        );
        record = await Record.findOne({ title: "Final saved title" });
        const list = await logs();
        assert.equal(list.total, 1);
        const event = list.items[0];
        assert.equal(event.collection, "AuditItems");
        assert.equal(event.action, "create");
        assert.equal(event.recordLabel, "Final saved title");
        assert.equal(event.recordCount, 1);
        assert.equal(event.schemaVersion, 2);
        assert.equal(event.changes, undefined);
        assert.equal(event.path, undefined);
        assert.equal(event.method, undefined);
        const persisted = await Log.find({}).lean();
        assert.equal(persisted.length, 1);
        assert.deepEqual(persisted[0].changes, []);
        assert(!JSON.stringify(persisted).includes("private-field-value"));
        assert(!JSON.stringify(persisted).includes("automatic side effect"));
      },
    );
    await t.test(
      "no-op saves, rejected operations and background read work do not generate logs",
      async () => {
        const before = (await logs()).total;
        assert.equal(
          (
            await mutate(
              "update",
              { title: "Final saved title" },
              String(record._id),
            )
          ).status,
          200,
        );
        assert.equal((await api("GET", "/audit-background")).status, 200);
        assert.equal(
          (await mutate("rejected", null, String(record._id))).status,
          400,
        );
        assert.equal((await logs()).total, before);
      },
    );
    await t.test(
      "a batch confirmation is one activity and states how many records were affected",
      async () => {
        assert.equal(
          (
            await mutate(
              "batch",
              [
                { title: "Batch one" },
                { title: "Batch two" },
                { title: "Batch three" },
              ],
              null,
              admin,
            )
          ).status,
          200,
        );
        let list = await logs();
        assert.equal(list.total, 2);
        assert.equal(list.items[0].recordCount, 3);
        assert.equal(list.items[0].action, "create");
        assert.equal(
          (await mutate("updateMany", { deleted: true }, null, admin)).status,
          200,
        );
        list = await logs();
        assert.equal(list.total, 3);
        assert.equal(list.items[0].recordCount, 4);
        assert.equal(list.items[0].action, "delete");
        assert.equal((await mutate("delete", null, null, admin)).status, 200);
        list = await logs();
        assert.equal(list.total, 4);
        assert.equal(list.items[0].recordCount, 4);
      },
    );
    await t.test(
      "administrator directory includes every active user and can isolate a user with no history",
      async () => {
        const list = await logs();
        assert(list.actors.some((actor) => actor._id === String(other._id)));
        assert.equal(list.actors.length, 4);
        const empty = await logs(admin, "actorId=" + other._id);
        assert.equal(empty.total, 0);
        assert.deepEqual(empty.summary, { create: 0, update: 0, delete: 0 });
        assert.equal(empty.actors.length, 4);
        const own = await logs(admin, "actorId=" + user._id);
        assert.equal(own.total, 1);
        assert(own.items.every((item) => item.actorId === String(user._id)));
        const paged = await api(
          "GET",
          "/audit-logs?limit=1&page=2",
          null,
          admin,
        );
        assert.equal(paged.data.items.length, 1);
        assert.equal(paged.data.total, list.total);
        assert.deepEqual(paged.data.summary, list.summary);
      },
    );
    await t.test(
      "ordinary users cannot expand their personal history or see other user directories",
      async () => {
        const own = await logs(user, "actorId=" + admin._id);
        assert.equal(own.total, 1);
        assert.deepEqual(own.actors, []);
        assert(own.items.every((item) => item.actorId === String(user._id)));
        const empty = await logs(other);
        assert.equal(empty.total, 0);
        assert.deepEqual(empty.actors, []);
        assert.deepEqual(empty.collections, []);
        assert.equal((await api("GET", "/audit-logs", null, null)).status, 401);
        assert.equal(
          (
            await api("GET", "/audit-logs", null, user, {
              "X-Crm-Data-User": String(admin._id),
            })
          ).status,
          403,
        );
        assert.equal((await logs(developer)).total, (await logs(admin)).total);
      },
    );
    await t.test(
      "profile changes, sign-in and sign-out each produce one summary while preserving the existing profile token",
      async () => {
        const existing = token(user),
          before = (await logs(user)).total;
        const edited = await api(
          "PUT",
          "/user/edit/" + user._id,
          {
            firstName: "Renamed",
            lastName: "Person",
            username: "renamed@example.test",
          },
          existing,
        );
        assert.equal(edited.status, 200);
        assert.equal(edited.data.user.username, "renamed@example.test");
        assert.equal(
          (await api("GET", "/user/view/" + user._id, null, existing)).status,
          200,
        );
        let own = await logs(user);
        assert.equal(own.total, before + 1);
        assert.equal(own.items[0].collection, "User");
        assert.equal(own.items[0].recordLabel, "Renamed Person");
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
        own = await logs(user);
        assert.equal(own.total, before + 3);
        assert.equal(
          own.items.filter((item) => item.action === "login").length,
          1,
        );
        assert.equal(
          own.items.filter((item) => item.action === "logout").length,
          1,
        );
      },
    );
    await t.test(
      "legacy field details stay private and generic module APIs cannot modify logs",
      async () => {
        await Log.collection.insertOne({
          actorId: user._id,
          actorName: "Old actor",
          action: "update",
          entityCollection: "User",
          method: "PUT",
          recordLabel: "Old profile",
          createdAt: new Date(),
          changes: [
            {
              field: "customFields.raw",
              before: "technical-before",
              after: "technical-after",
            },
          ],
        });
        const list = await logs();
        assert(!JSON.stringify(list.items).includes("technical-before"));
        assert(!JSON.stringify(list.items).includes("customFields.raw"));
        const CustomField = require("../model/schema/customField"),
          metadata = await CustomField.create({
            moduleName: "AuditLog",
            fields: [],
          });
        for (const actor of [user, admin, developer])
          assert.equal(
            (await api("GET", "/form/?moduleId=" + metadata._id, null, actor))
              .status,
            404,
          );
        assert.equal(
          (
            await api(
              "POST",
              "/custom-field/add-module",
              { moduleName: "AuditLog" },
              admin,
            )
          ).status,
          400,
        );
        assert.equal(
          (await api("GET", "/audit-logs?page=0", null, admin)).status,
          400,
        );
        assert.equal(
          (await api("GET", "/audit-logs?from=bad", null, admin)).status,
          400,
        );
      },
    );
    await t.test(
      "MongoDB automatically expires logs older than 14 days while retaining recent history and other records",
      { timeout: 150000 },
      async () => {
        const indexes = await Log.collection.indexes();
        const retention = indexes.find(
          (index) => index.name === "audit_log_retention_14_days",
        );
        assert(retention, "Retention index must exist in MongoDB");
        assert.deepEqual(retention.key, { createdAt: 1 });
        assert.equal(retention.expireAfterSeconds, 14 * 24 * 60 * 60);

        const originalCount = await Log.countDocuments();
        const now = Date.now();
        const hour = 60 * 60 * 1000;
        const retentionMs = retention.expireAfterSeconds * 1000;
        const oldIds = [],
          recentIds = [];
        for (const actor of [admin, user]) {
          for (const expired of [true, false]) {
            const item = await Log.create({
              actorId: actor._id,
              actorName: "Retention fixture",
              action: "update",
              schemaVersion: 2,
              entityCollection: "AuditItems",
              createdAt: new Date(now - retentionMs + (expired ? -hour : hour)),
            });
            (expired ? oldIds : recentIds).push(item._id);
          }
        }
        const normalRecord = await Record.collection.insertOne({
          title: "Old business record must remain",
          createdAt: new Date(now - retentionMs - hour),
        });
        // Exercise the real TTL monitor, not an application delete or mocked timer.
        const deadline = Date.now() + 120000;
        while (await Log.countDocuments({ _id: { $in: oldIds } })) {
          assert(Date.now() < deadline, "MongoDB TTL did not expire old logs");
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        assert.equal(await Log.countDocuments({ _id: { $in: recentIds } }), 2);
        assert.equal(await Log.countDocuments(), originalCount + 2);
        assert(
          await Record.collection.findOne({ _id: normalRecord.insertedId }),
        );
        const recent = await logs();
        assert(
          recent.items.every(
            (item) => !oldIds.some((id) => String(id) === item._id),
          ),
        );
      },
    );
  },
);
