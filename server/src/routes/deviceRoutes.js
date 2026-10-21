const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { registerDevice, getAllDevices, getDeviceById } = require("../controllers/deviceController");
const {
  getDeviceHistory,
  recordDeviceProcess,
  verifyDeviceLifecycle,
} = require("../controllers/lifecycleController");

const router = express.Router();

router.post("/", requireAuth, registerDevice);
router.get("/", requireAuth, getAllDevices);
router.get("/:id/history", requireAuth, getDeviceHistory);
router.get("/:id/verify", requireAuth, verifyDeviceLifecycle);
router.post("/:id/process", requireAuth, recordDeviceProcess);
router.get("/:id", requireAuth, getDeviceById);

module.exports = router;