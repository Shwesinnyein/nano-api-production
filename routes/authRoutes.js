const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController")

// router.post("/send-otp", authController.sendOTP);
// router.post("/verify-otp", authController.verifyOTP);
// router.post("/generate-secret", authController.generateSecret);

router.post("/send-otp", authController.sendOTP);
router.post("/verify-otp", authController.verifyOTP);
router.post("/generate-secret", authController.generateSecret);
router.post("/login", authController.loginWithIdToken_OLD); // OLD LOGIN - BACKUP
router.post("/login-email-password", authController.loginWithEmailPassword); // NEW LOGIN
router.post("/mobile-login", authController.mobileLogin); // NEW: Mobile login with JWT token
router.post("/login-user", authController.loginUser); // NEW LOGIN ENDPOINT
router.post("/register-user", authController.registerUser); // NEW REGISTER ENDPOINT
router.post("/check-email", authController.checkEmail); // CHECK EMAIL EXISTS
router.post("/change-password", authController.changePassword); // CHANGE PASSWORD
router.post("/forgot-password", authController.forgotPassword); // FORGOT PASSWORD (FCM OTP)
router.post("/verify-reset-otp", authController.verifyResetOTP); // VERIFY RESET OTP
router.post("/reset-password", authController.resetPassword); // RESET PASSWORD (with OTP)
router.get("/verify-token", authController.verifyToken);
router.get("/employee/:authId", authController.getEmployeeByAuthId);


module.exports = router;
