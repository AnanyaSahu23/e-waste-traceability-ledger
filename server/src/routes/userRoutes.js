const express = require("express");
const { requireAuth } = require("../middleware/auth");

const {
  assignOrganization
} = require("../controllers/userController");

const router = express.Router();

router.patch("/:id/organization", requireAuth, assignOrganization);

module.exports = router;