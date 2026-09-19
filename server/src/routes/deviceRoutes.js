const express = require("express");
const { registerDevice, getAllDevices, getDeviceById } = require("../controllers/deviceController");

const router = express.Router();

router.post("/", registerDevice);
router.get("/", getAllDevices);
router.get("/:id", getDeviceById);

module.exports = router;