const express = require("express");
const { requireAuth } = require("../middleware/auth");

const {
  createOrganization,
  getAllOrganizations,
  getOrganizationById
} = require("../controllers/organizationController");

const router = express.Router();

router.post("/", requireAuth, createOrganization);

router.get("/", getAllOrganizations);

router.get("/:id", getOrganizationById);

module.exports = router;