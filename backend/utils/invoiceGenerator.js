const PDFDocument = require("pdfkit");

const formatCurrency = (amount) => {
  return `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;
};

const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const drawLine = (doc, y) => {
  doc
    .moveTo(50, y)
    .lineTo(545, y)
    .strokeColor("#e5e7eb")
    .lineWidth(1)
    .stroke();
};

const generateInvoicePdf = (order, res) => {
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
  });

  const invoiceNumber = `WL-${String(order._id).slice(-8).toUpperCase()}`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=wearlance-invoice-${invoiceNumber}.pdf`
  );

  doc.pipe(res);

  // Header
  doc
    .rect(0, 0, 595.28, 115)
    .fill("#111827");

  doc
    .fillColor("#ffffff")
    .fontSize(28)
    .font("Helvetica-Bold")
    .text("WEARLANCE", 50, 34);

  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("EVERY STYLE Rs. 399", 50, 68);

  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .text("TAX INVOICE", 400, 42, {
      align: "right",
    });

  doc
    .fontSize(10)
    .font("Helvetica")
    .text(`Invoice No: ${invoiceNumber}`, 350, 70, {
      align: "right",
    });

  // Invoice meta
  doc
    .fillColor("#111827")
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("Order Details", 50, 145);

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#374151")
    .text(`Order ID: ${order._id}`, 50, 166)
    .text(`Order Date: ${formatDate(order.createdAt)}`, 50, 183)
    .text(`Order Status: ${order.orderStatus}`, 50, 200)
    .text(`Payment Method: ${order.paymentMethod}`, 50, 217)
    .text(`Payment Status: ${order.paymentStatus}`, 50, 234);

  doc
    .font("Helvetica-Bold")
    .fillColor("#111827")
    .fontSize(12)
    .text("Bill To", 330, 145);

  const address = order.shippingAddress || {};

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#374151")
    .text(address.fullName || "-", 330, 166)
    .text(address.phone || "-", 330, 183)
    .text(address.email || "-", 330, 200)
    .text(address.addressLine1 || "-", 330, 217)
    .text(address.addressLine2 || "", 330, 234)
    .text(`${address.city || ""}, ${address.state || ""}`, 330, 251)
    .text(`Pincode: ${address.pincode || "-"}`, 330, 268);

  drawLine(doc, 300);

  // Table header
  let y = 325;

  doc
    .rect(50, y, 495, 30)
    .fill("#f3f4f6");

  doc
    .fillColor("#111827")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("Item", 60, y + 10)
    .text("Size", 285, y + 10)
    .text("Qty", 340, y + 10)
    .text("Price", 395, y + 10)
    .text("Total", 475, y + 10);

  y += 42;

  // Items
  doc.font("Helvetica").fontSize(10).fillColor("#374151");

  order.orderItems.forEach((item, index) => {
    if (y > 690) {
      doc.addPage();
      y = 60;
    }

    doc
      .font("Helvetica-Bold")
      .fillColor("#111827")
      .text(`${index + 1}. ${item.name}`, 60, y, {
        width: 210,
      });

    doc
      .font("Helvetica")
      .fillColor("#6b7280")
      .fontSize(9)
      .text(item.category || "-", 60, y + 15, {
        width: 210,
      });

    doc
      .fontSize(10)
      .fillColor("#374151")
      .text(item.size || "-", 285, y)
      .text(String(item.quantity || 1), 340, y)
      .text(formatCurrency(item.price), 395, y)
      .text(formatCurrency(item.price * item.quantity), 475, y);

    y += 42;
    drawLine(doc, y - 10);
  });

  y += 20;

  if (y > 650) {
    doc.addPage();
    y = 60;
  }

  // Totals
  const totalsX = 345;

  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#374151")
    .text("Items Price", totalsX, y)
    .text(formatCurrency(order.itemsPrice), 455, y, {
      align: "right",
      width: 90,
    });

  y += 24;

  doc
    .text("Delivery", totalsX, y)
    .fillColor("#16a34a")
    .text("FREE", 455, y, {
      align: "right",
      width: 90,
    });

  y += 28;

  doc
    .moveTo(totalsX, y)
    .lineTo(545, y)
    .strokeColor("#d1d5db")
    .stroke();

  y += 14;

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor("#111827")
    .text("Grand Total", totalsX, y)
    .text(formatCurrency(order.totalPrice), 455, y, {
      align: "right",
      width: 90,
    });

  // Footer
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#6b7280")
    .text(
      "Thank you for shopping with Wearlance. This is a computer generated invoice.",
      50,
      760,
      {
        align: "center",
        width: 495,
      }
    );

  doc.end();
};

module.exports = generateInvoicePdf;