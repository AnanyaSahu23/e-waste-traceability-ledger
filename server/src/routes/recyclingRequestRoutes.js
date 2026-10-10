const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { createRecyclingRequest, cancelRecyclingRequest, getRecyclingRequestById, getAllRecyclingRequests } = require("../controllers/recycleRequestController");

const router = express.Router();

router.post("/", requireAuth, createRecyclingRequest);
router.patch("/:id/cancel", requireAuth, cancelRecyclingRequest);
router.get("/", requireAuth, getAllRecyclingRequests);
router.get("/:id", requireAuth, getRecyclingRequestById);   

module.exports = router;