const express = require("express");
const qrcode = require("qrcode");
const speakeasy = require("speakeasy");
const employeeController = require("../controllers/employeeController");
 
const router = express.Router();

// router.post("/check-employee-mobile", employeeController.checkEmployeeMobile);


router.post("/check-employee", employeeController.checkEmployee);
router.post("/check-employee-mobile", employeeController.checkEmployeeMobile);
router.post("/login", employeeController.login);
router.post("/register", employeeController.register);
router.post("/check-email", employeeController.checkEmail);

// Specific routes before parameterized routes
router.get("/list", employeeController.getEmployeeList);
router.get("/stats", employeeController.getEmployeeStats);
router.get("/search", employeeController.searchEmployees);
router.get("/filter-options", employeeController.getEmployeeFilterOptions);
router.get("/shift-data/filter", authenticateToken, employeeController.getShiftDataWithFilter);
router.get("/shift/get-by-date", employeeController.getEmployeeShiftByDate);

// Parameterized routes (must come after specific routes)
router.get("/profile/:uid", employeeController.getProfileByUid);
router.get("/:employeeId/shift-data", employeeController.getEmployeeWithShiftData);

module.exports = router;
