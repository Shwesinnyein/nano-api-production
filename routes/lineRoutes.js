const express = require("express");
const lineController = require("../controllers/lineController")
const router = express.Router();


// router.post("/send-notification-line", lineController.sendLineNotification);
// router.get("/lineLoginCallback", lineController.lineLoginCallback);
// router.post("/send-notification-expense", lineController.sendLineNotificationExpense)
// router.post("/send-notification-income", lineController.sendLineNotificationIncome)
// router.post("/send-message-line", lineController.sendMessage)

router.post("/send-notification-line", lineController.sendLineNotification);
router.get("/lineLoginCallback", lineController.lineLoginCallback);
router.post("/send-notification-expense", lineController.sendLineNotificationExpense)
router.post("/send-notification-income", lineController.sendLineNotificationIncome)
router.post("/send-message-line", lineController.sendMessage)
// router.post("/send-notification-resignation", lineController.sendLineNotificationResignation) // TODO: Function not yet implemented in controller


module.exports = router;
