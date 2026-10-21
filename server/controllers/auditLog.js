const express = require("express");
const mongoose = require("mongoose");
const User = require("../model/schema/user");
const { ignoredCollections } = require("../services/auditLog");
const auth = require("../middelwares/auth");
const AuditLog = require("../model/schema/auditLog");
const { isAdmin } = require("../services/userRoles");
const router = express.Router();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function buildFilter(actor, query) {
  const filter = isAdmin(actor) ? {} : { actorId: actor._id };
  const invalid = () => {
    throw Object.assign(new Error("Invalid audit filter"), { status: 400 });
  };
  for (const value of Object.values(query))
    if (typeof value !== "string") invalid();
  if (isAdmin(actor) && query.actorId) {
    if (!/^[a-f\d]{24}$/i.test(query.actorId)) invalid();
    filter.actorId = query.actorId;
  }
  if (query.action) {
    if (
      !["create", "update", "delete", "rename", "login", "logout"].includes(
        query.action,
      )
    )
      invalid();
    filter.action = query.action;
  }
  if (query.collection) {
    if (query.collection.length > 150) invalid();
    filter.entityCollection = query.collection;
  }
  for (const [key, operator] of [
    ["from", "$gte"],
    ["to", "$lte"],
  ])
    if (query[key]) {
      if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(query[key])) invalid();
      const date = new Date(
        query[key].length === 10
          ? query[key] + (key === "to" ? "T23:59:59.999Z" : "T00:00:00.000Z")
          : query[key],
      );
      if (!Number.isFinite(date.getTime())) invalid();
      filter.createdAt = { ...filter.createdAt, [operator]: date };
    }
  if (filter.createdAt?.$gte > filter.createdAt?.$lte) invalid();
  if (query.q) {
    if (query.q.length > 150) invalid();
    const regex = new RegExp(escapeRegex(query.q.trim()), "i");
    filter.$or = [
      "actorName",
      "actorUsername",
      "entityCollection",
      "recordId",
      "recordLabel",
    ].map((field) => ({ [field]: regex }));
  }
  return filter;
}
router.get("/", auth, async (req, res, next) => {
  try {
    const filter = buildFilter(req.actor, req.query);
    const eligible = {
      entityCollection: { $nin: [...ignoredCollections] },
      $or: [
        { schemaVersion: 2 },
        { method: { $in: ["POST", "PUT", "PATCH", "DELETE"] } },
        { action: { $in: ["login", "logout"] } },
      ],
    };
    filter.$and = [eligible];
    const page = Number(req.query.page || 1),
      limit = Number(req.query.limit || 25);
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 100000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      return res.status(400).json({ code: "invalid" });
    const scope = {
      ...eligible,
      ...(isAdmin(req.actor) ? {} : { actorId: req.actor._id }),
    };
    const aggregateFilter = {
      ...filter,
      ...(filter.actorId
        ? { actorId: new mongoose.Types.ObjectId(String(filter.actorId)) }
        : {}),
    };
    const [items, statistics, actors, collections, activeUsers] =
      await Promise.all([
        AuditLog.find(filter)
          .select("-changes -path -method -requestId")
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        AuditLog.aggregate([
          { $match: aggregateFilter },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              create: {
                $sum: { $cond: [{ $eq: ["$action", "create"] }, 1, 0] },
              },
              update: {
                $sum: { $cond: [{ $eq: ["$action", "update"] }, 1, 0] },
              },
              delete: {
                $sum: { $cond: [{ $eq: ["$action", "delete"] }, 1, 0] },
              },
            },
          },
        ]),
        isAdmin(req.actor)
          ? AuditLog.aggregate([
              { $match: eligible },
              { $sort: { createdAt: -1, _id: -1 } },
              {
                $group: {
                  _id: "$actorId",
                  name: { $first: "$actorName" },
                  username: { $first: "$actorUsername" },
                },
              },
              { $sort: { name: 1, username: 1 } },
            ])
          : [],
        AuditLog.distinct("entityCollection", scope),
        isAdmin(req.actor)
          ? User.find({ deleted: { $ne: true } })
              .select("_id firstName lastName username")
              .sort({ firstName: 1, lastName: 1, username: 1 })
              .lean()
          : [],
      ]);
    const directory = new Map(
      actors.map((actor) => [String(actor._id), { ...actor, inactive: true }]),
    );
    for (const user of activeUsers)
      directory.set(String(user._id), {
        _id: user._id,
        name: [user.firstName, user.lastName].filter(Boolean).join(" "),
        username: user.username,
        inactive: false,
      });
    const {
      total = 0,
      create = 0,
      update = 0,
      delete: removed = 0,
    } = statistics[0] || {};
    res.json({
      summary: { create, update, delete: removed },
      items: items.map(({ entityCollection, ...item }) => ({
        ...item,
        collection: entityCollection,
        recordCount: item.recordCount || 1,
      })),
      total,
      page,
      limit,
      actors: [...directory.values()],
      collections,
    });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ code: "invalid" });
    next(error);
  }
});
module.exports = router;
module.exports.buildFilter = buildFilter;
