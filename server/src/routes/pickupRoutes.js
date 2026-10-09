
const express = require("express");
const { requireAuth } = require("../middleware/auth");

const {
  getPickupRequests,
  getPickupRequestById,
  schedulePickup,
  updatePickupStatus,
} = require("../controllers/pickupController");

const router = express.Router();

router.get("/", requireAuth, getPickupRequests);
router.get("/:id", requireAuth, getPickupRequestById);
router.patch("/:id/schedule", requireAuth, schedulePickup);
router.patch("/:id/status", requireAuth, updatePickupStatus);

module.exports = router;
