const express = require("express");
const attendanceController = require("../controllers/attendanceController");

const router = express.Router();

// Attendance routes
router.post("/check-in-out", attendanceController.checkInOut);

// Specific routes before parameterized routes
router.get("/search-history", attendanceController.searchEmployeeAttendance);
router.get("/search-by-name", attendanceController.searchAttendanceByName);
router.get("/history", attendanceController.getAllAttendanceHistory);

// Update attendance route (before parameterized routes)
router.put("/update/:attendanceId", attendanceController.updateAttendance);

// Parameterized routes
router.get("/status/:employeeId", attendanceController.getTodayAttendanceStatus);
router.get("/history/:employeeId", attendanceController.getCheckInOutHistory);
router.get("/my-history/:employeeId", attendanceController.getMyAttendanceHistory);
router.get("/auto-checkin/:employeeId", attendanceController.checkAutoCheckInNeeded);
router.get("/:employeeId/:date", attendanceController.getAttendanceByEmployeeAndDate);
router.get("/:employeeId", attendanceController.getAttendanceByEmployeeId);

module.exports = router;
