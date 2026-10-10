const express = require("express");
const router = express.Router();

const { verifyLedger } = require("../controllers/ledgerController");

router.get("/verify/:deviceId", verifyLedger);

module.exports = router;