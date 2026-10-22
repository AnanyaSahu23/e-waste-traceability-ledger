const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { registerDevice, getAllDevices, getDeviceById } = require("../controllers/deviceController");
const {
  getDeviceHistory,
  recordDeviceProcess,
  verifyDeviceLifecycle,
} = require("../controllers/lifecycleController");
const {
  recordMaterialRecovery,
  getMaterialRecoveries,
  recordDisposal,
  getDeviceDisposals,
} = require("../controllers/materialRecoveryController");

const router = express.Router();

router.post("/", requireAuth, registerDevice);
router.get("/", requireAuth, getAllDevices);
router.get("/:id/history", requireAuth, getDeviceHistory);
router.get("/:id/verify", requireAuth, verifyDeviceLifecycle);
router.post("/:id/material-recovery", requireAuth, recordMaterialRecovery);
router.get("/:id/material-recovery", requireAuth, getMaterialRecoveries);
router.post("/:id/disposal", requireAuth, recordDisposal);
router.get("/:id/disposal", requireAuth, getDeviceDisposals);
router.post("/:id/process", requireAuth, recordDeviceProcess);
router.get("/:id", requireAuth, getDeviceById);

module.exports = router;