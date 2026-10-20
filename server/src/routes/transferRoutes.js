const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  requestCustodyTransfer,
  acceptCustodyTransfer,
} = require("../controllers/transferController");

const router = express.Router();

router.post("/", requireAuth, requestCustodyTransfer);
router.post("/:id/accept", requireAuth, acceptCustodyTransfer);

module.exports = router;
