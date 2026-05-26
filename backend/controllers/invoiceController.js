const Order = require("../models/Order");
const { generateInvoicePdfBuffer, getInvoiceFileName } = require("../utils/invoicePdf");

const downloadInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate("user", "name email isAdmin");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const isOwner = String(order.user?._id || order.user) === String(req.user._id);
    const isAdmin = Boolean(req.user.isAdmin);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized to download this invoice" });
    }

    if (order.paymentMethod === "COD" && !order.adminConfirmed && !isAdmin) {
      return res.status(400).json({
        success: false,
        message: "Invoice will be available after admin confirms your COD order",
      });
    }

    const pdfBuffer = generateInvoicePdfBuffer(order);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${getInvoiceFileName(order)}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { downloadInvoice };
