const express = require('express');
const img = require('./imagesController.js');
const auth = require('../../middelwares/auth');

const router = express.Router();
const { loadUser, adminOnly } = require('../../middelwares/permissions');
router.use((req, res, next) => ['GET', 'HEAD'].includes(req.method) ? next() : auth(req, res, () => loadUser(req, res, () => adminOnly(req, res, next))));

router.get("/", img.index);
router.get("/view/:id", auth, img.view);
router.post("/change-authImg", auth, img.upload.single('authImg'), img.validateUploads, img.addAuthImg);
router.put("/change-authImg/:id", auth, img.upload.single('authImg'), img.validateUploads, img.UpdateAuthImg);
router.put("/change-logoImg/:id", auth, img.upload.fields([{ name: 'logoSmImg', maxCount: 1 }, { name: 'logoLgImg', maxCount: 1 }]), img.validateUploads, img.changeLogoImg);
router.delete('/delete/:id', auth, img.deleteData);
router.put('/isActive/:id', auth, img.setActiveImg);
router.post("/add-auth-logo-img", auth, img.upload.fields([{ name: 'authImg', maxCount: 1 }, { name: 'logoSmImg', maxCount: 1 }, { name: 'logoLgImg', maxCount: 1 }]), img.validateUploads, img.addAuthAndLogoImg);
router.put("/change-auth-logo-img/:id", auth, img.upload.fields([{ name: 'authImg', maxCount: 1 }, { name: 'logoSmImg', maxCount: 1 }, { name: 'logoLgImg', maxCount: 1 }]), img.validateUploads, img.updateAuthAndLogoImg);

router.use("/authImg", require('../../services/secureFiles').publicImageHeaders, express.static(require('path').resolve(__dirname, '../../uploads/images'), { dotfiles: 'deny', index: false }));
router.use("/logoImg", require('../../services/secureFiles').publicImageHeaders, express.static(require('path').resolve(__dirname, '../../uploads/images'), { dotfiles: 'deny', index: false }));

module.exports = router;