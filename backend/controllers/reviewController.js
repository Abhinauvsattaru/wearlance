const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");

const recalculateProductRating = async (productId) => {
  const reviews = await Review.find({ product: productId });

  const numReviews = reviews.length;

  const rating =
    numReviews === 0
      ? 0
      : reviews.reduce((sum, review) => sum + review.rating, 0) / numReviews;

  await Product.findByIdAndUpdate(productId, {
    rating: Number(rating.toFixed(1)),
    numReviews,
    reviews: numReviews,
  });
};

const createReview = async (req, res) => {
  try {
    const { productId, orderId, rating, comment } = req.body;

    if (!productId || !orderId || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: "Product, order, rating and comment are required",
      });
    }

    const numericRating = Number(rating);

    if (numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (String(order.user) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You can review only your own orders",
      });
    }

    if (order.orderStatus !== "Delivered" || !order.isDelivered) {
      return res.status(400).json({
        success: false,
        message: "You can review only after delivery is confirmed",
      });
    }

    const productWasPurchased = order.orderItems.some(
      (item) => String(item.product) === String(productId)
    );

    if (!productWasPurchased) {
      return res.status(400).json({
        success: false,
        message: "This product was not purchased in this order",
      });
    }

    const alreadyReviewed = await Review.findOne({
      user: req.user._id,
      product: productId,
      order: orderId,
    });

    if (alreadyReviewed) {
      return res.status(400).json({
        success: false,
        message: "You already reviewed this product from this order",
      });
    }

    const review = await Review.create({
      user: req.user._id,
      product: productId,
      order: orderId,
      userName: req.user.name,
      rating: numericRating,
      comment,
    });

    await recalculateProductRating(productId);

    const updatedProduct = await Product.findById(productId);

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      review,
      product: updatedProduct,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You already reviewed this product from this order",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getProductReviews = async (req, res) => {
  try {
    const reviews = await Review.find({
      product: req.params.productId,
    })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getMyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({
      user: req.user._id,
    })
      .populate("product", "name image category rating numReviews")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createReview,
  getProductReviews,
  getMyReviews,
};
