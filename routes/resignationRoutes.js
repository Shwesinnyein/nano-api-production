const express = require("express");
const resignationController = require("../controllers/resignationController");
const router = express.Router();


router.post("/send-notification-resignation", resignationController.sendLineNotificationResignation);


module.exports = router;
