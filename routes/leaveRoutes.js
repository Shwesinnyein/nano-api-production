const express = require("express");
const leaveController = require("../controllers/leaveController");
const multer = require('multer');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow common document types
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
        const extname = allowedTypes.test(file.originalname.toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images and documents are allowed'));
        }
    }
});

// Middleware to conditionally use multer only for multipart/form-data
const conditionalUpload = (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
        // Use multer for file uploads
        return upload.array('attachments', 5)(req, res, next);
    } else {
        // Skip multer for JSON requests (attachments will be URLs in body)
        next();
    }
};

// Leave routes
router.get("/settings", leaveController.getLeaveSettings);
router.get("/employee/:uid", leaveController.getEmployeeLeaveList);
router.get("/balance/:employeeId", leaveController.getEmployeeLeaveBalance); // Get leave balance
router.get("/list", leaveController.getLeaveListByRole); // Get leave list with role-based filtering
router.get("/history", leaveController.getLeaveHistory); // NEW: Get leave history with strict status filtering
router.post("/create", conditionalUpload, leaveController.createLeaveRequest);
router.get("/all", leaveController.getAllLeaveRequests);
router.get("/:leaveId", leaveController.getLeaveRequestById);
router.put("/:leaveId/status", leaveController.updateLeaveRequestStatus);

// Multi-level approval routes
router.get("/approval/pending", leaveController.getLeaveRequestsByApprovalLevel);
router.put("/approval/:leaveId", leaveController.approveLeaveRequest);

module.exports = router;
