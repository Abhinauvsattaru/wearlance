const crypto = require("crypto");
const Razorpay = require("razorpay");
const axios = require("axios");

const Order = require("../models/Order");
const Product = require("../models/Product");
const sendEmail = require("../utils/sendEmail");

const { orderConfirmationTemplate } = require("../utils/emailTemplates");

const FIXED_PRICE = 399;

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const razorpayApiFetch = async (endpoint, options = {}) => {
  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString("base64");

  const response = await axios({
    url: `https://api.razorpay.com/v1${endpoint}`,
    method: options.method || "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    data: options.body ? JSON.parse(options.body) : undefined,
  });

  return response.data;
};

const validateOrderData = async ({ orderItems, shippingAddress, paymentMethod }) => {
  if (!orderItems || orderItems.length === 0) {
    throw new Error("No order items provided");
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
    throw new Error("Complete shipping address is required");
  }

  const finalOrderItems = [];

  for (const item of orderItems) {
    const productId = item.product || item._id || item.id;

    if (!productId) {
      throw new Error("Invalid product in order");
    }

    const product = await Product.findById(productId);

    if (!product) {
      throw new Error(`Product not found: ${item.name || productId}`);
    }

    if (!item.size) {
      throw new Error(`Size is required for ${product.name}`);
    }

    const quantity = Number(item.quantity || item.qty || 1);

    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new Error("Quantity must be at least 1");
    }

    if (product.stock <= 0) {
      throw new Error(`${product.name} is out of stock`);
    }

    if (product.stock < quantity) {
      throw new Error(`Only ${product.stock} units available for ${product.name}`);
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
  }

  const itemsPrice = finalOrderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const shippingPrice = 0;
  const totalPrice = itemsPrice + shippingPrice;

  return {
    finalOrderItems,
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
    paymentMethod: paymentMethod || "Razorpay",
    itemsPrice,
    shippingPrice,
    totalPrice,
  };
};

const reduceStock = async (orderItems) => {
  for (const item of orderItems) {
    const product = await Product.findById(item.product);

    if (product) {
      product.stock = Math.max(0, product.stock - item.quantity);
      await product.save();
    }
  }
};

const createPaidOrderAfterVerification = async ({
  req,
  validatedOrder,
  paymentMethod,
  razorpayOrderId = "",
  razorpayPaymentId = "",
  razorpaySignature = "",
  razorpayQrCodeId = "",
}) => {
  const order = await Order.create({
    user: req.user._id,
    orderItems: validatedOrder.finalOrderItems,
    shippingAddress: validatedOrder.shippingAddress,
    paymentMethod,
    itemsPrice: validatedOrder.itemsPrice,
    shippingPrice: validatedOrder.shippingPrice,
    totalPrice: validatedOrder.totalPrice,
    paymentStatus: "Paid",
    orderStatus: "Placed",
    stockRestored: false,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    razorpayQrCodeId,
  });

  await reduceStock(order.orderItems);

  await sendEmail({
    to: order.shippingAddress.email,
    subject: `Wearlance Paid Order Confirmed #${String(order._id)
      .slice(-8)
      .toUpperCase()}`,
    html: orderConfirmationTemplate(order),
  });

  return order;
};

const createRazorpayOrder = async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Razorpay keys are missing in .env",
      });
    }

    const validatedOrder = await validateOrderData(req.body);

    const razorpayOrder = await razorpay.orders.create({
      amount: validatedOrder.totalPrice * 100,
      currency: "INR",
      receipt: `wearlance_${Date.now()}`,
      notes: {
        userId: String(req.user._id),
        customerEmail: validatedOrder.shippingAddress.email,
        brand: "Wearlance",
      },
    });

    res.status(200).json({
      success: true,
      message: "Razorpay order created successfully",
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrder,
      amount: validatedOrder.totalPrice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error.response?.data?.error?.description ||
        error.response?.data?.message ||
        error.message,
    });
  }
};

const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderData,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Razorpay payment details are required",
      });
    }

    if (!orderData) {
      return res.status(400).json({
        success: false,
        message: "Order data is required",
      });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    const validatedOrder = await validateOrderData(orderData);

    const order = await createPaidOrderAfterVerification({
      req,
      validatedOrder,
      paymentMethod: "Razorpay",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    res.status(201).json({
      success: true,
      message: "Payment verified and order placed successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error.response?.data?.error?.description ||
        error.response?.data?.message ||
        error.message,
    });
  }
};

const createQrPayment = async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Razorpay keys are missing in .env",
      });
    }

    const validatedOrder = await validateOrderData({
      ...req.body,
      paymentMethod: "Razorpay QR",
    });

    const closeBy = Math.floor(Date.now() / 1000) + 30 * 60;

    const qrCode = await razorpayApiFetch("/payments/qr_codes", {
      method: "POST",
      body: JSON.stringify({
        type: "upi_qr",
        name: `Wearlance Order ${Date.now()}`,
        usage: "single_use",
        fixed_amount: true,
        payment_amount: validatedOrder.totalPrice * 100,
        description: `Wearlance payment ₹${validatedOrder.totalPrice}`,
        close_by: closeBy,
        notes: {
          userId: String(req.user._id),
          customerEmail: validatedOrder.shippingAddress.email,
          brand: "Wearlance",
        },
      }),
    });

    res.status(200).json({
      success: true,
      message: "QR created successfully",
      qrCode,
      amount: validatedOrder.totalPrice,
      expiresAt: closeBy,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error.response?.data?.error?.description ||
        error.response?.data?.message ||
        error.message,
    });
  }
};

const verifyQrPayment = async (req, res) => {
  try {
    const { qrCodeId, orderData } = req.body;

    if (!qrCodeId) {
      return res.status(400).json({
        success: false,
        message: "QR Code ID is required",
      });
    }

    if (!orderData) {
      return res.status(400).json({
        success: false,
        message: "Order data is required",
      });
    }

    const validatedOrder = await validateOrderData({
      ...orderData,
      paymentMethod: "Razorpay QR",
    });

    const payments = await razorpayApiFetch(
      `/payments/qr_codes/${qrCodeId}/payments?count=10`,
      {
        method: "GET",
      }
    );

    const capturedPayment = payments.items?.find((payment) => {
      return (
        payment.status === "captured" &&
        payment.amount === validatedOrder.totalPrice * 100
      );
    });

    if (!capturedPayment) {
      return res.status(200).json({
        success: false,
        paymentPending: true,
        message:
          "Payment not received yet. Scan the QR and then click Check Payment again.",
      });
    }

    const order = await createPaidOrderAfterVerification({
      req,
      validatedOrder,
      paymentMethod: "Razorpay QR",
      razorpayPaymentId: capturedPayment.id,
      razorpayQrCodeId: qrCodeId,
    });

    res.status(201).json({
      success: true,
      message: "QR payment verified and order placed successfully",
      order,
      payment: capturedPayment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error.response?.data?.error?.description ||
        error.response?.data?.message ||
        error.message,
    });
  }
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
  createQrPayment,
  verifyQrPayment,
};