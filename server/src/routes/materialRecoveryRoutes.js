const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  getMaterialRecovery,
} = require("../controllers/materialRecoveryController");

const router = express.Router();

router.get("/:recoveryId", requireAuth, getMaterialRecovery);

module.exports = router;
