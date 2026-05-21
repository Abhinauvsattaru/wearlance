const Order = require("../models/Order");
const generateInvoicePdf = require("../utils/invoiceGenerator");

const downloadInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate(
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
        message: "Not authorized to download this invoice",
      });
    }

    generateInvoicePdf(order, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  downloadInvoice,
};