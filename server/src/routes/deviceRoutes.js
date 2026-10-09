const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { registerDevice, getAllDevices, getDeviceById } = require("../controllers/deviceController");

const router = express.Router();

router.post("/", requireAuth, registerDevice);
router.get("/", requireAuth, getAllDevices);
router.get("/:id", requireAuth, getDeviceById);

module.exports = router;