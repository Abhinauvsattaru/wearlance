const escapePdfText = (value = "") => {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/₹/g, "Rs.")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
};

const money = (amount) => `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;

const getOrderShortId = (order) => String(order._id || "").slice(-8).toUpperCase();

const getInvoiceFileName = (order) => `wearlance-invoice-${getOrderShortId(order)}.pdf`;

const text = (x, y, value, font = "F1", size = 10) => {
  return `BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET\n`;
};

const line = (x1, y1, x2, y2) => `${x1} ${y1} m ${x2} ${y2} l S\n`;
const rect = (x, y, w, h, fill = false) => `${x} ${y} ${w} ${h} re ${fill ? "f" : "S"}\n`;

const buildPdf = (content) => {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = add("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  const pageId = add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>");
  const contentId = add(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
  const fontRegularId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
};

const generateInvoicePdfBuffer = (order) => {
  const shortId = getOrderShortId(order);
  const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString("en-IN") : new Date().toLocaleString("en-IN");
  const status = order.orderStatus || "Placed";
  const paymentMethod = order.paymentMethod || "COD";
  const paymentStatus = order.paymentStatus || "Pending";
  const isPendingCod = order.paymentMethod === "COD" && !order.adminConfirmed;
  const invoiceTitle = isPendingCod ? "PENDING ORDER INVOICE" : "TAX INVOICE";
  const confirmationText = isPendingCod
    ? "Admin confirmation pending - this invoice will update after confirmation"
    : "Admin confirmed - official order invoice";
  const address = order.shippingAddress || {};
  const items = Array.isArray(order.orderItems) ? order.orderItems : [];

  let c = "";
  c += "0.06 0.09 0.16 rg\n";
  c += rect(0, 742, 595, 100, true);
  c += "0.98 0.45 0.09 rg\n";
  c += rect(0, 742, 9, 100, true);
  c += "1 1 1 rg\n";
  c += text(36, 797, "WEARLANCE", "F2", 24);
  c += text(36, 777, "EVERY STYLE Rs.399", "F1", 10);
  c += text(392, 797, invoiceTitle, "F2", isPendingCod ? 14 : 18);
  c += text(435, 777, `Invoice No: WL-${shortId}`, "F1", 9);

  c += "0 0 0 rg\n";
  c += text(36, 712, "Order Details", "F2", 14);
  c += "0.89 0.91 0.94 RG\n";
  c += line(36, 704, 559, 704);
  c += text(36, 682, `Order ID: ${String(order._id || "")}`, "F1", 9);
  c += text(36, 666, `Order Date: ${createdAt}`, "F1", 9);
  c += text(36, 650, `Order Status: ${status}`, "F1", 9);
  c += text(36, 634, `Payment: ${paymentMethod} - ${paymentStatus}`, "F1", 9);
  c += isPendingCod ? "0.98 0.45 0.09 rg\n" : "0.09 0.64 0.29 rg\n";
  c += text(36, 616, confirmationText, "F2", 8);
  c += "0 0 0 rg\n";

  c += text(320, 712, "Bill To", "F2", 14);
  c += line(320, 704, 559, 704);
  const billLines = [
    address.fullName || "Customer",
    address.phone || "",
    address.email || "",
    address.addressLine1 || "",
    address.addressLine2 || "",
    `${address.city || ""}${address.state ? `, ${address.state}` : ""}`,
    address.pincode ? `Pincode: ${address.pincode}` : "",
  ].filter(Boolean);

  let by = 682;
  billLines.slice(0, 7).forEach((value) => {
    c += text(320, by, value.slice(0, 42), "F1", 8.5);
    by -= 14;
  });

  let y = 548;
  c += "0.06 0.09 0.16 rg\n";
  c += rect(36, y, 523, 26, true);
  c += "1 1 1 rg\n";
  c += text(48, y + 9, "Item", "F2", 9);
  c += text(355, y + 9, "Size", "F2", 9);
  c += text(410, y + 9, "Qty", "F2", 9);
  c += text(460, y + 9, "Price", "F2", 9);
  c += text(518, y + 9, "Total", "F2", 9);

  y -= 28;
  c += "0 0 0 rg\n";
  items.slice(0, 8).forEach((item, index) => {
    c += "0.97 0.98 0.99 rg\n";
    c += rect(36, y - 8, 523, 24, true);
    c += "0 0 0 rg\n";
    c += text(48, y, `${index + 1}. ${String(item.name || "Product").slice(0, 38)}`, "F2", 8.5);
    c += text(48, y - 13, `${item.category || "Fashion"}`, "F1", 7.5);
    c += text(355, y, item.size || "-", "F1", 8.5);
    c += text(410, y, item.quantity || 1, "F1", 8.5);
    c += text(460, y, money(item.price), "F1", 8.5);
    c += text(518, y, money(Number(item.price || 0) * Number(item.quantity || 1)), "F1", 8.5);
    y -= 32;
  });

  y -= 6;
  c += "0.89 0.91 0.94 RG\n";
  c += line(36, y, 559, y);
  y -= 26;
  c += "0 0 0 rg\n";
  c += text(390, y, "Items Price", "F1", 9);
  c += text(500, y, money(order.itemsPrice), "F2", 9);
  y -= 18;
  c += text(390, y, "Delivery", "F1", 9);
  c += text(500, y, "FREE", "F2", 9);
  y -= 20;
  c += "0.98 0.45 0.09 rg\n";
  c += rect(380, y - 9, 179, 30, true);
  c += "1 1 1 rg\n";
  c += text(392, y, "Grand Total", "F2", 11);
  c += text(500, y, money(order.totalPrice), "F2", 11);

  c += "0.40 0.45 0.53 rg\n";
  c += text(36, 88, isPendingCod ? "Note: This is a pending COD order invoice. Admin confirmation is not completed yet." : "Thank you for shopping with Wearlance.", "F2", 9);
  c += text(36, 72, isPendingCod ? "After admin confirmation, download invoice again to get the updated confirmed invoice." : "This invoice was generated after order confirmation.", "F1", 8);
  c += text(36, 56, "For support: abhinauv22@gmail.com | +91 8523813819", "F1", 8);

  return buildPdf(c);
};

module.exports = {
  generateInvoicePdfBuffer,
  getInvoiceFileName,
};
