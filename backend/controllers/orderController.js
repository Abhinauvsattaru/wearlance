const Order = require("../models/Order");
const Product = require("../models/Product");
const sendEmail = require("../utils/sendEmail");

const {
  orderConfirmationTemplate,
  orderStatusTemplate,
  deliveryOtpTemplate,
  returnRequestTemplate,
} = require("../utils/emailTemplates");

const FIXED_PRICE = 399;

const generateDeliveryOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const restoreStockIfNeeded = async (order) => {
  if (order.stockRestored) return;

  for (const item of order.orderItems) {
    const product = await Product.findById(item.product);

    if (product) {
      product.stock += item.quantity;
      await product.save();
    }
  }

  order.stockRestored = true;
};

const placeOrder = async (req, res) => {
  try {
    const { orderItems, shippingAddress, paymentMethod } = req.body;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No order items provided",
      });
    }

    if (
      !shippingAddress ||
      !shippingAddress.fullName ||
      !shippingAddress.phone ||
      !shippingAddress.email ||
      !shippingAddress.addressLine1 ||
      !shippingAddress.city ||
      !shippingAddress.state ||
      !shippingAddress.pincode
    ) {
      return res.status(400).json({
        success: false,
        message: "Complete shipping address is required",
      });
    }

    const finalOrderItems = [];
    const stockUpdates = [];

    for (const item of orderItems) {
      const productId = item.product || item._id || item.id;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: "Invalid product in order",
        });
      }

      const product = await Product.findById(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.name || productId}`,
        });
      }

      if (!item.size) {
        return res.status(400).json({
          success: false,
          message: `Size is required for ${product.name}`,
        });
      }

      const quantity = Number(item.quantity || item.qty || 1);

      if (!Number.isFinite(quantity) || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: "Quantity must be at least 1",
        });
      }

      if (product.stock <= 0) {
        return res.status(400).json({
          success: false,
          message: `${product.name} is out of stock`,
        });
      }

      if (product.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} units available for ${product.name}`,
        });
      }

      finalOrderItems.push({
        product: product._id,
        name: product.name,
        image: product.image,
        category: product.category,
        size: item.size,
        quantity,
        price: FIXED_PRICE,
      });

      stockUpdates.push({
        product,
        quantity,
      });
    }

    const itemsPrice = finalOrderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const shippingPrice = 0;
    const totalPrice = itemsPrice + shippingPrice;

    const order = await Order.create({
      user: req.user._id,
      orderItems: finalOrderItems,
      shippingAddress: {
        fullName: shippingAddress.fullName,
        phone: shippingAddress.phone,
        email: shippingAddress.email,
        addressLine1: shippingAddress.addressLine1,
        addressLine2: shippingAddress.addressLine2 || "",
        city: shippingAddress.city,
        state: shippingAddress.state,
        pincode: shippingAddress.pincode,
      },
      paymentMethod: paymentMethod || "COD",
      itemsPrice,
      shippingPrice,
      totalPrice,
      paymentStatus: "Pending",
      orderStatus: "Placed",
      stockRestored: false,
    });

    for (const update of stockUpdates) {
      update.product.stock = Math.max(0, update.product.stock - update.quantity);
      await update.product.save();
    }

    await sendEmail({
      to: order.shippingAddress.email,
      subject: `Wearlance Order Confirmed #${String(order._id)
        .slice(-8)
        .toUpperCase()}`,
      html: orderConfirmationTemplate(order),
    });

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getSingleOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "user",
      "name email isAdmin"
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const isOwner = String(order.user._id) === String(req.user._id);
    const isAdmin = req.user.isAdmin;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this order",
      });
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate("user", "name email isAdmin")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus } = req.body;

    const allowedStatuses = [
      "Placed",
      "Packed",
      "Shipped",
      "Out for Delivery",
      "Delivered",
      "Return Approved",
      "Returned",
      "Return Rejected",
      "Cancelled",
    ];

    if (!allowedStatuses.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (orderStatus === "Cancelled") {
      await restoreStockIfNeeded(order);

      order.orderStatus = "Cancelled";
      order.deliveryOtp = null;
      order.deliveryOtpExpires = null;
      order.isDelivered = false;
      order.deliveredAt = undefined;

      const updatedOrder = await order.save();

      await sendEmail({
        to: updatedOrder.shippingAddress.email,
        subject: "Wearlance Order Cancelled",
        html: orderStatusTemplate(updatedOrder),
      });

      return res.status(200).json({
        success: true,
        message: "Order cancelled and stock restored",
        order: updatedOrder,
      });
    }

    if (orderStatus === "Delivered") {
      const otp = generateDeliveryOtp();

      order.orderStatus = "Delivery Verification Pending";
      order.deliveryOtp = otp;
      order.deliveryOtpExpires = new Date(Date.now() + 30 * 60 * 1000);
      order.isDelivered = false;
      order.deliveredAt = undefined;

      const updatedOrder = await order.save();

      await sendEmail({
        to: updatedOrder.shippingAddress.email,
        subject: `Wearlance Delivery OTP #${String(updatedOrder._id)
          .slice(-8)
          .toUpperCase()}`,
        html: deliveryOtpTemplate(updatedOrder),
      });

      return res.status(200).json({
        success: true,
        message:
          "Delivery OTP sent to customer. Order will be delivered after OTP verification.",
        order: updatedOrder,
      });
    }

    if (orderStatus === "Returned") {
      await restoreStockIfNeeded(order);
      order.returnedAt = new Date();
    }

    if (orderStatus === "Return Rejected") {
      order.returnedAt = null;
    }

    order.orderStatus = orderStatus;

    const updatedOrder = await order.save();

    await sendEmail({
      to: updatedOrder.shippingAddress.email,
      subject: `Wearlance Order Update: ${updatedOrder.orderStatus}`,
      html: orderStatusTemplate(updatedOrder),
    });

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const verifyDeliveryOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "Delivery OTP is required",
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (String(order.user) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Only the customer can verify this delivery",
      });
    }

    if (order.orderStatus !== "Delivery Verification Pending") {
      return res.status(400).json({
        success: false,
        message: "This order is not waiting for delivery verification",
      });
    }

    if (!order.deliveryOtp || !order.deliveryOtpExpires) {
      return res.status(400).json({
        success: false,
        message: "No delivery OTP found. Ask admin to resend delivery status.",
      });
    }

    if (new Date() > order.deliveryOtpExpires) {
      order.deliveryOtp = null;
      order.deliveryOtpExpires = null;
      await order.save();

      return res.status(400).json({
        success: false,
        message: "Delivery OTP expired. Ask admin to mark delivered again.",
      });
    }

    if (String(order.deliveryOtp) !== String(otp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid delivery OTP",
      });
    }

    order.orderStatus = "Delivered";
    order.isDelivered = true;
    order.deliveredAt = new Date();
    order.deliveryOtp = null;
    order.deliveryOtpExpires = null;

    const updatedOrder = await order.save();

    await sendEmail({
      to: updatedOrder.shippingAddress.email,
      subject: "Wearlance Order Delivered Successfully",
      html: orderStatusTemplate(updatedOrder),
    });

    res.status(200).json({
      success: true,
      message: "Delivery confirmed successfully",
      order: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const cancelMyOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (String(order.user) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You can cancel only your own order",
      });
    }

    if (order.orderStatus === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "This order is already cancelled",
      });
    }

    await restoreStockIfNeeded(order);

    order.orderStatus = "Cancelled";
    order.deliveryOtp = null;
    order.deliveryOtpExpires = null;
    order.isDelivered = false;
    order.deliveredAt = undefined;

    const updatedOrder = await order.save();

    await sendEmail({
      to: updatedOrder.shippingAddress.email,
      subject: "Wearlance Order Cancelled",
      html: orderStatusTemplate(updatedOrder),
    });

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const requestReturnOrder = async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (String(order.user) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You can return only your own order",
      });
    }

    if (order.orderStatus !== "Delivered" || !order.isDelivered) {
      return res.status(400).json({
        success: false,
        message: "Return is available only after delivery is confirmed",
      });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Return reason is required",
      });
    }

    order.orderStatus = "Return Requested";
    order.returnReason = reason.trim();
    order.returnRequestedAt = new Date();

    const updatedOrder = await order.save();

    await sendEmail({
      to: updatedOrder.shippingAddress.email,
      subject: "Wearlance Return Request Received",
      html: returnRequestTemplate(updatedOrder),
    });

    res.status(200).json({
      success: true,
      message: "Return request submitted successfully",
      order: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  placeOrder,
  getMyOrders,
  getSingleOrder,
  getAllOrders,
  updateOrderStatus,
  verifyDeliveryOtp,
  cancelMyOrder,
  requestReturnOrder,
};
