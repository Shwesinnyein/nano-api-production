const express = require("express");
const router = express.Router();
const appController = require("../controllers/appController");

// App version check route
router.get("/version", appController.getAppVersion);

module.exports = router;

