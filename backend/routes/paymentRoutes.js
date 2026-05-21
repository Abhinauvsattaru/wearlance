const express = require("express");

const {
  createRazorpayOrder,
  verifyRazorpayPayment,
  createQrPayment,
  verifyQrPayment,
} = require("../controllers/paymentController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/create-order", protect, createRazorpayOrder);

router.post("/verify", protect, verifyRazorpayPayment);

router.post("/qr/create", protect, createQrPayment);

router.post("/qr/verify", protect, verifyQrPayment);

module.exports = router;