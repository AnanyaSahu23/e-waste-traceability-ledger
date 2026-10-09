const express = require("express");

const {
  createOrganization,
  getAllOrganizations,
  getOrganizationById
} = require("../controllers/organizationController");

const router = express.Router();

router.post("/", createOrganization);

router.get("/", getAllOrganizations);

router.get("/:id", getOrganizationById);

module.exports = router;