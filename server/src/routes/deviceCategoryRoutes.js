const express = require("express");
const router = express.Router();

const {
  getDeviceCategories,
} = require("../controllers/deviceCategoryController");

router.get("/", getDeviceCategories);

module.exports = router;