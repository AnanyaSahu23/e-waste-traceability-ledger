const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  getProfile,
  getIncomingRequests,
  decideRequest,
  getInventory,
  getTransfers,
  receiveRequest,
  getDashboard,
  getOrganizationDeviceTracking,
  verifyOrganizationDevice,
} = require("../controllers/organizationPortalController");

const router = express.Router();

router.use(requireAuth);
router.get("/profile", getProfile);
router.get("/dashboard", getDashboard);
router.get("/requests", getIncomingRequests);
router.patch("/requests/:id/decision", decideRequest);
router.post("/requests/:id/receive", receiveRequest);
router.get("/inventory", getInventory);
router.get("/transfers", getTransfers);
router.get("/devices/:id/tracking", getOrganizationDeviceTracking);
router.get("/devices/:id/verify", verifyOrganizationDevice);

module.exports = router;
