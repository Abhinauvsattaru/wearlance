const formatCurrency = (amount) => {
  return `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;
};

const baseShell = ({ title, subtitle, content }) => {
  return `
  <div style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="max-width:720px;margin:0 auto;padding:28px;">
      <div style="background:linear-gradient(135deg,#111827,#2874f0,#fb641b);border-radius:28px;padding:34px;text-align:center;color:white;">
        <h1 style="margin:0;font-size:38px;letter-spacing:-1px;">WEARLANCE</h1>
        <p style="margin:8px 0 0;font-weight:700;letter-spacing:2px;">EVERY STYLE Rs.399</p>
      </div>

      <div style="background:white;border-radius:26px;padding:30px;margin-top:22px;box-shadow:0 18px 45px rgba(15,23,42,0.10);">
        <h2 style="margin:0 0 10px;font-size:28px;">${title}</h2>
        <p style="font-size:16px;line-height:1.7;color:#64748b;margin:0;">${subtitle}</p>
        ${content}
      </div>

      <p style="text-align:center;color:#94a3b8;font-size:13px;margin-top:18px;">
        This is an automated email from Wearlance.
      </p>
    </div>
  </div>
  `;
};

const otpTemplate = ({ name, otp }) => {
  return baseShell({
    title: "Your Wearlance OTP",
    subtitle: `Hi ${name || "there"}, use the OTP below to securely continue.`,
    content: `
      <div style="text-align:center;margin:30px 0;">
        <div style="display:inline-block;background:#111827;color:white;font-size:38px;letter-spacing:8px;font-weight:900;padding:18px 30px;border-radius:20px;">
          ${otp}
        </div>
      </div>

      <p style="font-size:15px;line-height:1.7;color:#64748b;margin:0;">
        This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.
      </p>
    `,
  });
};

const deliveryOtpTemplate = (order) => {
  return baseShell({
    title: "Confirm Your Delivery",
    subtitle:
      "Your order has reached the delivery confirmation stage. Share this OTP only after receiving your order.",
    content: `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:18px;margin-top:24px;">
        <p style="margin:0;color:#64748b;">Order ID</p>
        <h3 style="margin:6px 0 0;color:#111827;">#${String(order._id)
          .slice(-8)
          .toUpperCase()}</h3>
      </div>

      <div style="text-align:center;margin:30px 0;">
        <div style="display:inline-block;background:#fb641b;color:white;font-size:38px;letter-spacing:8px;font-weight:900;padding:18px 30px;border-radius:20px;">
          ${order.deliveryOtp}
        </div>
      </div>

      <p style="color:#64748b;line-height:1.7;">
        This OTP is valid for <strong>30 minutes</strong>. Your order will be marked as delivered only after this OTP is verified.
      </p>
    `,
  });
};

const returnRequestTemplate = (order) => {
  return baseShell({
    title: "Return Request Received",
    subtitle: `Your return request for order #${String(order._id)
      .slice(-8)
      .toUpperCase()} has been received.`,
    content: `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:18px;margin-top:24px;">
        <p style="margin:0;color:#64748b;">Return reason</p>
        <h3 style="margin:6px 0 0;color:#111827;">${order.returnReason || "Not provided"}</h3>
      </div>

      <p style="color:#64748b;line-height:1.7;">
        The Wearlance team will review this return request and update the order status.
      </p>
    `,
  });
};

const orderItemsHtml = (order) => {
  return order.orderItems
    .map(
      (item) => `
        <tr>
          <td style="padding:14px;border-bottom:1px solid #e5e7eb;">
            <div style="display:flex;gap:12px;align-items:center;">
              <img src="${item.image}" alt="${item.name}" style="width:64px;height:64px;object-fit:cover;border-radius:14px;" />
              <div>
                <div style="font-weight:800;color:#111827;">${item.name}</div>
                <div style="font-size:13px;color:#64748b;">${item.category} - Size ${item.size} - Qty ${item.quantity}</div>
              </div>
            </div>
          </td>
          <td style="padding:14px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:800;color:#111827;">
            ${formatCurrency(item.price * item.quantity)}
          </td>
        </tr>
      `
    )
    .join("");
};

const orderSummaryHtml = (order) => {
  return `
    <table style="width:100%;border-collapse:collapse;margin-top:24px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:12px;color:#64748b;border-bottom:2px solid #e5e7eb;">Item</th>
          <th style="text-align:right;padding:12px;color:#64748b;border-bottom:2px solid #e5e7eb;">Amount</th>
        </tr>
      </thead>
      <tbody>${orderItemsHtml(order)}</tbody>
    </table>

    <div style="margin-top:24px;background:#fff7ed;border:1px solid #fed7aa;border-radius:18px;padding:18px;">
      <div style="display:flex;justify-content:space-between;font-size:16px;margin-bottom:8px;">
        <span>Items Total</span>
        <strong>${formatCurrency(order.itemsPrice)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:16px;margin-bottom:8px;">
        <span>Delivery</span>
        <strong style="color:#16a34a;">FREE</strong>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:22px;border-top:1px solid #fed7aa;padding-top:12px;margin-top:12px;">
        <span><strong>Total</strong></span>
        <strong>${formatCurrency(order.totalPrice)}</strong>
      </div>
    </div>
  `;
};

const orderReceivedTemplate = (order) => {
  return baseShell({
    title: "Order received - awaiting admin confirmation",
    subtitle:
      "Thank you for placing a COD order. Wearlance admin will confirm your phone/address before delivery assignment.",
    content: `
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:18px;padding:18px;margin-top:24px;">
        <p style="margin:0;color:#92400e;line-height:1.7;">
          Your order is visible in My Orders, but it is not confirmed yet. Invoice will be sent after admin confirmation.
        </p>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:18px;margin-top:24px;">
        <p style="margin:0;color:#64748b;">Order ID</p>
        <h3 style="margin:6px 0 0;color:#111827;">#${String(order._id)
          .slice(-8)
          .toUpperCase()}</h3>
      </div>

      ${orderSummaryHtml(order)}
    `,
  });
};

const orderConfirmationTemplate = (order, options = {}) => {
  return baseShell({
    title: "Your COD order is confirmed",
    subtitle:
      "Wearlance has confirmed your COD order. We will prepare it and assign delivery soon.",
    content: `
      <div style="background:#dcfce7;border:1px solid #86efac;border-radius:18px;padding:18px;margin-top:24px;">
        <p style="margin:0;color:#166534;line-height:1.7;">
          ${options.invoiceAttached ? "Your invoice PDF is attached with this email." : "Your invoice is now available for download."}
        </p>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:18px;margin-top:24px;">
        <p style="margin:0;color:#64748b;">Order ID</p>
        <h3 style="margin:6px 0 0;color:#111827;">#${String(order._id)
          .slice(-8)
          .toUpperCase()}</h3>
      </div>

      ${orderSummaryHtml(order)}
    `,
  });
};

const orderStatusTemplate = (order) => {
  const cancellationHtml =
    order.orderStatus === "Cancelled" && order.cancellationDetails?.reason
      ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:18px;padding:18px;margin-top:20px;">
          <p style="margin:0;color:#991b1b;"><strong>Cancellation reason:</strong> ${order.cancellationDetails.reason}</p>
        </div>`
      : "";

  return baseShell({
    title: "Your order status changed",
    subtitle: `Your Wearlance order #${String(order._id)
      .slice(-8)
      .toUpperCase()} has a new update.`,
    content: `
      <div style="text-align:center;margin:28px 0;">
        <span style="display:inline-block;background:#2874f0;color:white;padding:14px 24px;border-radius:999px;font-size:20px;font-weight:800;">
          ${order.orderStatus}
        </span>
      </div>

      ${cancellationHtml}

      <p style="color:#64748b;line-height:1.7;">
        We will keep you updated as your order moves forward. Thank you for shopping with Wearlance.
      </p>
    `,
  });
};

module.exports = {
  otpTemplate,
  deliveryOtpTemplate,
  returnRequestTemplate,
  orderReceivedTemplate,
  orderConfirmationTemplate,
  orderStatusTemplate,
};
