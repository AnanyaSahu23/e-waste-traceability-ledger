const express = require("express");
const router = express.Router();

const {
  getDeviceTracking,
} = require("../controllers/trackingController");

router.get("/:deviceId", getDeviceTracking);

module.exports = router;
