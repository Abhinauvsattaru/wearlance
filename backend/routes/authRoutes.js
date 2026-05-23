const express = require("express");

const {
  registerUser,
  loginUser,
  verifyDeliveryLoginOtp,
  deliveryLogout,
  verifySignupOtp,
  resendSignupOtp,
  forgotPassword,
  resetPasswordWithOtp,
  getMe,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);

router.post("/login", loginUser);

router.post("/verify-delivery-login-otp", verifyDeliveryLoginOtp);

router.post("/delivery-logout", protect, deliveryLogout);

router.post("/verify-signup-otp", verifySignupOtp);

router.post("/resend-signup-otp", resendSignupOtp);

router.post("/forgot-password", forgotPassword);

router.post("/reset-password", resetPasswordWithOtp);

router.get("/me", protect, getMe);

module.exports = router;
