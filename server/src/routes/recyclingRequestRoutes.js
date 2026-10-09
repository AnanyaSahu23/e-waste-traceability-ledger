const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { createRecyclingRequest, cancelRecyclingRequest } = require("../controllers/recycleRequestController");

const router = express.Router();

router.post("/", requireAuth, createRecyclingRequest);
router.patch("/:id/cancel", requireAuth, cancelRecyclingRequest);

module.exports = router;