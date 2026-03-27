const express = require("express");
const router = express.Router();
const auth = require("../controllers/authController");
const { checkAuth } = require("../middleware/auth");

router.post("/register", auth.register);
router.post("/login", auth.login);
router.post("/verify-email", auth.verifyEmail);
router.post("/resend-otp", auth.resendVerifyCode);
router.post("/forgot-password", auth.forgotPassword);
router.post("/reset-password", auth.resetPassword);

// Protected change password
router.post("/change-password", checkAuth, auth.changePassword);

module.exports = router;
