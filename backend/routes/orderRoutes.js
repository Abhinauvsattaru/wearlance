const express = require("express");

const {
  placeOrder,
  getMyOrders,
  getSingleOrder,
  getAllOrders,
  updateOrderStatus,
  verifyDeliveryOtp,
  cancelMyOrder,
  requestReturnOrder,
} = require("../controllers/orderController");

const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, placeOrder);

router.get("/my-orders", protect, getMyOrders);

router.get("/admin/all", protect, adminOnly, getAllOrders);

router.get("/:id", protect, getSingleOrder);

router.put("/:id/status", protect, adminOnly, updateOrderStatus);

router.put("/:id/verify-delivery", protect, verifyDeliveryOtp);

router.put("/:id/cancel", protect, cancelMyOrder);

router.put("/:id/return", protect, requestReturnOrder);

module.exports = router;
