const express = require("express");

const {
  createReview,
  getProductReviews,
  getMyReviews,
} = require("../controllers/reviewController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createReview);

router.get("/my-reviews", protect, getMyReviews);

router.get("/product/:productId", getProductReviews);

module.exports = router;
