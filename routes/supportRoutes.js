const express = require('express');
const router = express.Router();
const multer = require('multer');
const supportController = require('../controllers/supportController');

// Configure multer for file uploads (screenshots)
// Store files in memory as buffer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max per file
        files: 5 // Max 5 screenshots per report
    }
});

// POST /support/problem-report - Submit a new problem report
router.post('/problem-report', upload.array('screenshots', 5), supportController.submitProblemReport);

// GET /support/problem-reports/employee/:employeeId - Get all reports for an employee
router.get('/problem-reports/employee/:employeeId', supportController.getEmployeeProblemReports);

// GET /support/problem-report/:reportId - Get single report by ID
router.get('/problem-report/:reportId', supportController.getProblemReportById);

module.exports = router;

