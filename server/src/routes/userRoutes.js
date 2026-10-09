const express = require("express");

const {
  assignOrganization
} = require("../controllers/userController");

const router = express.Router();

router.patch("/:id/organization", assignOrganization);

module.exports = router;