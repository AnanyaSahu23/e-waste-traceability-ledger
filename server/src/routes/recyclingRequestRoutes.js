const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { cancelRecyclingRequest } = require("../controllers/recycleRequestController");

const router = express.Router();

router.patch("/:id/cancel", requireAuth, cancelRecyclingRequest);

module.exports = router;