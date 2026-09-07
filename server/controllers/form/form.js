const mongoose = require("mongoose");
const CustomField = require("../../model/schema/customField");

const getFieldType = (field) => {
  if (field?.ref) {
    return {
      type: mongoose.Schema.Types.ObjectId,
      ref: field.ref,
    };
  }

  return field?.backendType || mongoose.Schema.Types.Mixed;
};

const getModel = (customField) => {
  const collectionName = customField?.moduleName;

  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }

  const schemaFields = {};
  customField?.fields?.forEach((field) => {
    if (field?.name) {
      schemaFields[field.name] = getFieldType(field);
    }
  });

  schemaFields.customFields = { type: mongoose.Schema.Types.Mixed, default: {} };
  const moduleSchema = new mongoose.Schema(schemaFields);
  return mongoose.model(collectionName, moduleSchema, collectionName);
};

const isRequiredField = (field) => {
  return field?.validation?.some((rule) => rule?.require);
};

const shouldRemoveEmptyValue = (field, value) => {
  if (value !== "" || isRequiredField(field)) {
    return false;
  }

  const emptyValueTypes = ["Number", "Date", "Boolean", "ObjectId"];
  return field?.ref || emptyValueTypes.includes(field?.backendType);
};

const sanitizePayload = (body, fields = []) => {
  const payload = { ...body };

  fields.forEach((field) => {
    if (shouldRemoveEmptyValue(field, payload[field?.name])) {
      delete payload[field.name];
    }
  });

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  return payload;
};

const buildUpdatePayload = (body, fields = []) => {
  const payload = { ...body };
  const unsetPayload = {};

  fields.forEach((field) => {
    if (shouldRemoveEmptyValue(field, payload[field?.name])) {
      delete payload[field.name];
      unsetPayload[field.name] = "";
    }
  });

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  const updatePayload = { $set: payload };

  if (Object.keys(unsetPayload).length > 0) {
    updatePayload.$unset = unsetPayload;
  }

  return updatePayload;
};

const index = async (req, res) => {
  try {
    if (!req?.query?.moduleId) {
      return res
        .status(400)
        .send({ success: false, message: "moduleId is required" });
    }

    const customFieldName = await CustomField.findById(
      req.query?.moduleId,
    ).select("moduleName fields");

    if (!customFieldName) {
      return res
        .status(404)
        .send({ success: false, message: "Module not found" });
    }

    const collectionName = customFieldName.moduleName;
    const collectionExists = await mongoose.connection.db
      .listCollections({ name: collectionName })
      .hasNext();

    if (!collectionExists) {
      return res
        .status(404)
        .send({ success: false, message: "Collection does not exist" });
    }

    const ExistingModel = getModel(customFieldName);

    if (!ExistingModel) {
      return res
        .status(500)
        .send({ success: false, message: "Model not found" });
    }

    const allData = await ExistingModel.find({ deleted: false, ...require('../../middelwares/permissions').scope(req) });

    return res.status(200).json({ data: allData });
  } catch (err) {
    console.error(`Failed to display Record`, err);
    return res
      .status(400)
      .json({
        success: false,
        message: `no data found`,
        error: err.toString(),
      });
  }
};

const view = async (req, res) => {
  try {
    if (!req?.query?.moduleId) {
      return res
        .status(400)
        .send({ success: false, message: "moduleId is required" });
    }

    const customField = await CustomField.findById(req.query?.moduleId).select(
      "moduleName fields",
    );

    if (!customField) {
      return res
        .status(404)
        .send({ success: false, message: "Module not found" });
    }

    const collectionName = customField.moduleName;
    const collectionExists = await mongoose.connection.db
      .listCollections({ name: collectionName })
      .hasNext();

    if (!collectionExists) {
      return res
        .status(404)
        .send({ success: false, message: "Collection does not exist" });
    }

    const ExistingModel = getModel(customField);

    if (!ExistingModel) {
      return res
        .status(500)
        .send({ success: false, message: "Model not found" });
    }

    let allData = await ExistingModel.findOne({ _id: req.params.id });

    return res.status(200).json({ data: allData });
  } catch (err) {
    console.error(`Failed to display Record`, err);
    return res
      .status(400)
      .json({
        success: false,
        message: `no data found`,
        error: err.toString(),
      });
  }
};

const add = async (req, res) => {
  try {
    if (!req?.body?.moduleId) {
      return res
        .status(400)
        .send({ success: false, message: "moduleId is required" });
    }

    const customField = await CustomField.findById(req.body?.moduleId).select(
      "moduleName fields",
    );

    if (!customField) {
      return res
        .status(404)
        .send({ success: false, message: "Module not found" });
    }

    const collectionName = customField.moduleName;
    const collectionExists = await mongoose.connection.db
      .listCollections({ name: collectionName })
      .hasNext();

    if (!collectionExists) {
      return res
        .status(404)
        .send({ success: false, message: "Collection does not exist" });
    }

    const ExistingModel = getModel(customField);

    if (!ExistingModel) {
      return res
        .status(500)
        .send({ success: false, message: "Model not found" });
    }
    const payload = sanitizePayload(req.body, customField?.fields);
    payload.updatedDate = new Date();
    payload.deleted = false;

    const newDocument = new ExistingModel(payload);
    newDocument.createdDate = new Date();

    await newDocument.save();

    return res
      .status(200)
      .json({ message: "Record added successfully", data: newDocument });
  } catch (err) {
    console.error(`Failed to create Record`, err);
    return res
      .status(400)
      .json({
        success: false,
        message: `Failed to Add Record`,
        error: err.toString(),
      });
  }
};

const deleteField = async (req, res) => {
  try {
    if (!req.query?.moduleId) {
      return res
        .status(400)
        .send({ success: false, message: "moduleId is required" });
    }

    const customField = await CustomField.findOne({
      _id: req.query?.moduleId,
    }).select("moduleName fields");

    if (!customField) {
      return res
        .status(404)
        .send({ success: false, message: "Module not found" });
    }

    const collectionExists = await mongoose.connection.db
      .listCollections({ name: `${customField?.moduleName}` })
      .hasNext();

    if (!collectionExists) {
      return res
        .status(404)
        .send({ success: false, message: "Collection not exists" });
    }

    const ExistingModel = getModel(customField);

    if (typeof ExistingModel !== "function") {
      return res.status(500).send({ success: false, message: "Invalid model" });
    }

    const result = await ExistingModel.findByIdAndUpdate(req.params.id, {
      deleted: true,
    });

    return res
      .status(200)
      .json({ message: "Record deleted successfully", data: result });
  } catch (err) {
    console.error(`Failed to delete Record`, err);
    return res
      .status(400)
      .json({
        success: false,
        message: `Failed to delete Record`,
        error: err.toString(),
      });
  }
};

const deleteManyField = async (req, res) => {
  try {
    if (!req.body?.moduleId) {
      return res
        .status(400)
        .send({ success: false, message: "moduleId is required" });
    }

    const customField = await CustomField.findOne({
      _id: req.body?.moduleId,
    }).select("moduleName fields");

    if (!customField) {
      return res
        .status(404)
        .send({ success: false, message: "Module not found" });
    }

    const collectionExists = await mongoose.connection.db
      .listCollections({ name: `${customField?.moduleName}` })
      .hasNext();

    if (!collectionExists) {
      return res
        .status(404)
        .send({ success: false, message: "Collection not exists" });
    }

    const ExistingModel = getModel(customField);

    if (typeof ExistingModel !== "function") {
      return res.status(500).send({ success: false, message: "Invalid model" });
    }

    const result = await ExistingModel.updateMany(
      { _id: { $in: req.body.ids } },
      { $set: { deleted: true } },
    );

    return res
      .status(200)
      .json({ message: "Record deleted successfully", data: result });
  } catch (err) {
    console.error(`Failed to delete Record`, err);
    return res
      .status(400)
      .json({
        success: false,
        message: `Failed to delete Record`,
        error: err.toString(),
      });
  }
};

const edit = async (req, res) => {
  try {
    if (!req?.body?.moduleId) {
      return res
        .status(400)
        .send({ success: false, message: "moduleId is required" });
    }

    const customField = await CustomField.findOne({
      _id: req.body?.moduleId,
    }).select("moduleName fields");

    if (!customField) {
      return res
        .status(404)
        .send({ success: false, message: "Module not found" });
    }

    const collectionName = customField?.moduleName;

    const collectionExists = await mongoose.connection.db
      .listCollections({ name: collectionName })
      .hasNext();

    if (!collectionExists) {
      return res
        .status(404)
        .send({
          success: false,
          message: `Collection '${collectionName}' not exists`,
        });
    }

    const ExistingModel = getModel(customField);

    if (typeof ExistingModel !== "function") {
      return res.status(500).send({ success: false, message: "Invalid model" });
    }

    const result = await ExistingModel.findOneAndUpdate(
      { _id: req.params.id },
      buildUpdatePayload(req.body, customField?.fields),
      { new: true, runValidators: true },
    );

    if (result) {
      return res
        .status(200)
        .json({
          success: true,
          message: "Record updated successfully",
          data: result,
        });
    } else {
      return res
        .status(404)
        .json({ success: false, message: "Record not found for the given id" });
    }
  } catch (err) {
    console.error(`Failed to Update Record`, err);
    return res
      .status(400)
      .json({
        success: false,
        message: `Failed to Update Record`,
        error: err.toString(),
      });
  }
};

module.exports = { index, view, add, edit, deleteField, deleteManyField };
