const Order = require("../models/Order");
const Product = require("../models/Product");
const DeliveryPartner = require("../models/DeliveryPartner");
const DeliveryActionLog = require("../models/DeliveryActionLog");
const sendEmail = require("../utils/sendEmail");

const {
  orderConfirmationTemplate,
  orderStatusTemplate,
  deliveryOtpTemplate,
  returnRequestTemplate,
} = require("../utils/emailTemplates");

const FIXED_PRICE = 399;


const getRequestIp = (req) => {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    ""
  );
};

const getRequestDevice = (req) => {
  return String(req.headers["user-agent"] || "").slice(0, 300);
};

const writeDeliveryLog = async ({
  req,
  order = null,
  deliveryPartner = null,
  action,
  result = "info",
  note = "",
}) => {
  try {
    await DeliveryActionLog.create({
      order,
      deliveryPartner,
      actor: req.user._id,
      action,
      result,
      note,
      ip: getRequestIp(req),
      device: getRequestDevice(req),
    });
  } catch (error) {
    console.error("Delivery log failed:", error.message);
  }
};

const pushOrderTimeline = ({ order, req, deliveryPartner = null, action, note = "" }) => {
  order.deliveryTimeline.push({
    action,
    by: req.user._id,
    deliveryPartner,
    note,
    ip: getRequestIp(req),
    device: getRequestDevice(req),
    at: new Date(),
  });
};

const getMyApprovedDeliveryPartner = async (req) => {
  return DeliveryPartner.findOne({
    user: req.user._id,
    status: "approved",
    isActive: true,
  });
};


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


const confirmCodOrder = async (req, res) => {
  try {
    const { note } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.paymentMethod !== "COD") {
      return res.status(400).json({
        success: false,
        message: "Only COD orders require manual confirmation",
      });
    }

    if (["Delivered", "Cancelled", "Returned"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "Completed orders cannot be confirmed",
      });
    }

    order.adminConfirmed = true;
    order.adminConfirmedBy = req.user._id;
    order.adminConfirmedAt = new Date();
    order.orderStatus = "Admin Confirmed";

    if (note && note.trim()) {
      order.adminNotes.push({
        note: note.trim(),
        by: req.user._id,
        at: new Date(),
      });
    }

    const updatedOrder = await order.save();

    await sendEmail({
      to: updatedOrder.shippingAddress.email,
      subject: "Wearlance COD Order Confirmed",
      html: orderStatusTemplate(updatedOrder),
    });

    res.status(200).json({
      success: true,
      message: "COD order confirmed. You can now assign delivery partner.",
      order: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const addAdminOrderNote = async (req, res) => {
  try {
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({
        success: false,
        message: "Note is required",
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    order.adminNotes.push({
      note: note.trim(),
      by: req.user._id,
      at: new Date(),
    });

    const updatedOrder = await order.save();

    res.status(200).json({
      success: true,
      message: "Admin note added",
      order: updatedOrder,
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
    const order = await Order.findById(req.params.id)
      .populate("user", "name email isAdmin")
      .populate("assignedDeliveryPartner", "name email phone city status isActive")
      .populate("adminConfirmedBy", "name email")
      .populate("adminNotes.by", "name email");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (["Delivered", "Cancelled", "Returned"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "Completed orders cannot be changed",
      });
    }

    const isOwner = String(order.user._id) === String(req.user._id);
    const isAdmin = req.user.isAdmin;

    let isAssignedDeliveryPartner = false;

    if (order.assignedDeliveryPartner) {
      const myDeliveryPartner = await getMyApprovedDeliveryPartner(req);

      isAssignedDeliveryPartner =
        myDeliveryPartner &&
        String(order.assignedDeliveryPartner._id) === String(myDeliveryPartner._id);
    }

    if (!isOwner && !isAdmin && !isAssignedDeliveryPartner) {
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
      .populate("assignedDeliveryPartner", "name email phone city status isActive")
      .populate("adminConfirmedBy", "name email")
      .populate("adminNotes.by", "name email")
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
      "Admin Confirmed",
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

    if (orderStatus === "Admin Confirmed") {
      order.adminConfirmed = true;
      order.adminConfirmedBy = req.user._id;
      order.adminConfirmedAt = new Date();
    }

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

    if (
      ["Picked Up", "Out for Delivery", "Delivery Verification Pending", "Delivered", "Returned"].includes(
        order.orderStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Cancellation is locked after the order enters delivery flow",
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


const assignDeliveryPartner = async (req, res) => {
  try {
    const { deliveryPartnerId } = req.body;

    if (!deliveryPartnerId) {
      return res.status(400).json({
        success: false,
        message: "Delivery partner is required",
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (["Delivered", "Cancelled", "Returned", "Return Rejected"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "Cannot assign delivery partner to this order status",
      });
    }

    if (order.paymentMethod === "COD" && !order.adminConfirmed) {
      return res.status(400).json({
        success: false,
        message: "Confirm this COD order before assigning a delivery partner",
      });
    }

    const partner = await DeliveryPartner.findOne({
      _id: deliveryPartnerId,
      status: "approved",
      isActive: true,
    });

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Approved active delivery partner not found",
      });
    }

    const previousPartnerId = order.assignedDeliveryPartner
      ? String(order.assignedDeliveryPartner)
      : "";

    order.assignedDeliveryPartner = partner._id;
    order.deliveryAssignedAt = new Date();

    if (["Placed", "Admin Confirmed"].includes(order.orderStatus)) {
      order.orderStatus = "Packed";
    }

    pushOrderTimeline({
      order,
      req,
      deliveryPartner: partner._id,
      action: "DELIVERY_PARTNER_ASSIGNED",
      note: `Assigned to ${partner.name} (${partner.email})`,
    });

    const updatedOrder = await order.save();

    if (previousPartnerId !== String(partner._id)) {
      partner.totalAssigned += 1;
      await partner.save();
    }

    await writeDeliveryLog({
      req,
      order: updatedOrder._id,
      deliveryPartner: partner._id,
      action: "ORDER_ASSIGNED_TO_DELIVERY_PARTNER",
      result: "success",
      note: `Order assigned to ${partner.email}`,
    });

    res.status(200).json({
      success: true,
      message: "Delivery partner assigned successfully",
      order: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getAssignedDeliveryOrders = async (req, res) => {
  try {
    const partner = await getMyApprovedDeliveryPartner(req);

    if (!partner) {
      return res.status(403).json({
        success: false,
        message: "Approved delivery partner access required",
      });
    }

    const orders = await Order.find({
      assignedDeliveryPartner: partner._id,
    })
      .populate("user", "name email")
      .populate("assignedDeliveryPartner", "name email phone city status isActive")
      .populate("adminConfirmedBy", "name email")
      .populate("adminNotes.by", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      partner,
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

const markPickedUpByDeliveryPartner = async (req, res) => {
  try {
    const partner = await getMyApprovedDeliveryPartner(req);

    if (!partner) {
      return res.status(403).json({
        success: false,
        message: "Approved delivery partner access required",
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (String(order.assignedDeliveryPartner) !== String(partner._id)) {
      return res.status(403).json({
        success: false,
        message: "This order is not assigned to you",
      });
    }

    if (["Cancelled", "Returned", "Delivered"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "This order cannot be picked up now",
      });
    }

    order.deliveryPickedUpAt = new Date();

    if (order.orderStatus === "Placed") {
      order.orderStatus = "Packed";
    }

    pushOrderTimeline({
      order,
      req,
      deliveryPartner: partner._id,
      action: "ORDER_PICKED_UP",
      note: "Delivery partner picked up the order",
    });

    const updatedOrder = await order.save();

    await writeDeliveryLog({
      req,
      order: updatedOrder._id,
      deliveryPartner: partner._id,
      action: "ORDER_PICKED_UP",
      result: "success",
      note: "Delivery partner marked order as picked up",
    });

    res.status(200).json({
      success: true,
      message: "Order marked as picked up",
      order: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const markOutForDeliveryByPartner = async (req, res) => {
  try {
    const partner = await getMyApprovedDeliveryPartner(req);

    if (!partner) {
      return res.status(403).json({
        success: false,
        message: "Approved delivery partner access required",
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (String(order.assignedDeliveryPartner) !== String(partner._id)) {
      return res.status(403).json({
        success: false,
        message: "This order is not assigned to you",
      });
    }

    if (["Cancelled", "Returned", "Delivered"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "This order cannot go out for delivery now",
      });
    }

    const otp = generateDeliveryOtp();

    order.orderStatus = "Out for Delivery";
    order.deliveryOtp = otp;
    order.deliveryOtpExpires = new Date(Date.now() + 30 * 60 * 1000);
    order.deliveryOutForDeliveryAt = new Date();
    order.isDelivered = false;
    order.deliveredAt = undefined;

    pushOrderTimeline({
      order,
      req,
      deliveryPartner: partner._id,
      action: "OUT_FOR_DELIVERY",
      note: "Delivery OTP sent to customer",
    });

    const updatedOrder = await order.save();

    await sendEmail({
      to: updatedOrder.shippingAddress.email,
      subject: `Wearlance Delivery OTP #${String(updatedOrder._id)
        .slice(-8)
        .toUpperCase()}`,
      html: deliveryOtpTemplate(updatedOrder),
    });

    await writeDeliveryLog({
      req,
      order: updatedOrder._id,
      deliveryPartner: partner._id,
      action: "OUT_FOR_DELIVERY",
      result: "success",
      note: "Delivery OTP sent to customer",
    });

    res.status(200).json({
      success: true,
      message: "Order is out for delivery. OTP sent to customer.",
      order: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const verifyDeliveryOtpByPartner = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "Delivery OTP is required",
      });
    }

    const partner = await getMyApprovedDeliveryPartner(req);

    if (!partner) {
      return res.status(403).json({
        success: false,
        message: "Approved delivery partner access required",
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (String(order.assignedDeliveryPartner) !== String(partner._id)) {
      return res.status(403).json({
        success: false,
        message: "This order is not assigned to you",
      });
    }

    if (!["Out for Delivery", "Delivery Verification Pending"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "This order is not waiting for delivery OTP verification",
      });
    }

    if (!order.deliveryOtp || !order.deliveryOtpExpires) {
      return res.status(400).json({
        success: false,
        message: "No delivery OTP found. Mark order out for delivery again.",
      });
    }

    if (new Date() > order.deliveryOtpExpires) {
      order.deliveryOtp = null;
      order.deliveryOtpExpires = null;
      await order.save();

      return res.status(400).json({
        success: false,
        message: "Delivery OTP expired. Mark order out for delivery again.",
      });
    }

    if (String(order.deliveryOtp) !== String(otp)) {
      await writeDeliveryLog({
        req,
        order: order._id,
        deliveryPartner: partner._id,
        action: "DELIVERY_OTP_FAILED",
        result: "failed",
        note: "Invalid OTP entered by delivery partner",
      });

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

    pushOrderTimeline({
      order,
      req,
      deliveryPartner: partner._id,
      action: "DELIVERY_OTP_VERIFIED",
      note: "Delivery confirmed by delivery partner OTP verification",
    });

    const updatedOrder = await order.save();

    partner.totalDelivered += 1;
    await partner.save();

    await sendEmail({
      to: updatedOrder.shippingAddress.email,
      subject: "Wearlance Order Delivered Successfully",
      html: orderStatusTemplate(updatedOrder),
    });

    await writeDeliveryLog({
      req,
      order: updatedOrder._id,
      deliveryPartner: partner._id,
      action: "DELIVERY_OTP_VERIFIED",
      result: "success",
      note: "Order delivered successfully",
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


module.exports = {
  placeOrder,
  confirmCodOrder,
  addAdminOrderNote,
  getMyOrders,
  getSingleOrder,
  getAllOrders,
  updateOrderStatus,
  verifyDeliveryOtp,
  cancelMyOrder,
  requestReturnOrder,
  assignDeliveryPartner,
  getAssignedDeliveryOrders,
  markPickedUpByDeliveryPartner,
  markOutForDeliveryByPartner,
  verifyDeliveryOtpByPartner,
};
