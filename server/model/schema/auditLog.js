const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    actorName: String,
    actorUsername: String,
    actorRole: String,
    action: {
      type: String,
      enum: ["create", "update", "delete", "rename", "login", "logout"],
      required: true,
    },
    schemaVersion: Number,
    operation: String,
    recordCount: { type: Number, default: 1 },
    entityCollection: String,
    recordId: String,
    recordLabel: String,
    changes: [
      {
        _id: false,
        field: String,
        before: mongoose.Schema.Types.Mixed,
        after: mongoose.Schema.Types.Mixed,
      },
    ],
    requestId: String,
    method: String,
    path: String,
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false, collection: "AuditLog" },
);
schema.index({ createdAt: -1, _id: -1 });
schema.index({ actorId: 1, createdAt: -1, _id: -1 });
module.exports = mongoose.model("AuditLog", schema);
