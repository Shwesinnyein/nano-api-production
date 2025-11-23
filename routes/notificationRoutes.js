const express = require('express');
const { 
    sendLeaveRequestNotification,
    sendLeaveStatusNotification,
    getNotifications,
    markNotificationAsRead,
    registerDevice,
    unregisterDevice,
    getUnreadCount,
    markAllAsRead,
    sendTestPush
} = require('../controllers/notificationController');

const router = express.Router();

// Notification routes - Leave requests only (FREE)

// Send leave request notification to manager
router.post('/leave-request', sendLeaveRequestNotification);

// Send leave approval/rejection notification to employee
router.post('/leave-status', sendLeaveStatusNotification);

// Unified notifications API - automatically handles employees and managers
router.get('/:employeeId', getNotifications);

// Mark notification as read
router.put('/:employeeId/read/:notificationId', markNotificationAsRead);

// Device registration
router.post('/devices/register', registerDevice);
router.delete('/devices/:token', unregisterDevice);

// Unread count and bulk read
router.get('/unread-count/:employeeId', getUnreadCount);
router.post('/read-all', markAllAsRead);

// Test push (admin/debug)
router.post('/push/test', sendTestPush);

module.exports = router;
