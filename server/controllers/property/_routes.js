const express = require("express");
const property = require("./property");
const auth = require("../../middelwares/auth");
const estateBridge = require('../../middelwares/estateBridge');
const { loadUser, permit } = require('../../middelwares/permissions');
const estateBatch = require('../../middelwares/estateBatch');
const guarded = require('../../middelwares/legacyScope');
const { Property } = require('../../model/schema/property');

const router = express.Router();

router.get("/", auth, loadUser, permit('Properties', 'view'), guarded.list, property.index);
router.post("/add", auth, estateBridge);
router.post("/addMany", auth, loadUser, estateBatch.add);
router.get("/view/:id", auth, loadUser, permit('Properties', 'view'), guarded.record(Property), property.view);
router.put("/edit/:id", auth, estateBridge);
router.delete("/delete/:id", auth, estateBridge);
router.post("/deleteMany", auth, loadUser, estateBatch.remove);

module.exports = router;
