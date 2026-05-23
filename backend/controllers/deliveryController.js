const crypto = require("crypto");
const PDFDocument = require("pdfkit");

const DeliveryPartner = require("../models/DeliveryPartner");
const DeliveryActionLog = require("../models/DeliveryActionLog");
const DeliveryAccessInvite = require("../models/DeliveryAccessInvite");
const sendEmail = require("../utils/sendEmail");

const ADMIN_EMAILS = [
  "abhinauv22@gmail.com",
  "abhinauvo5s@gmail.com",
  "fordealpen@gmail.com",
];

const normalizeEmail = (email = "") => String(email).trim().toLowerCase();

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

const isWearlanceAdmin = (user) => {
  const email = normalizeEmail(user?.email);

  return Boolean(
    user?.isAdmin ||
      user?.role === "admin" ||
      ADMIN_EMAILS.includes(email) ||
      String(process.env.ADMIN_EMAILS || "")
        .toLowerCase()
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .includes(email)
  );
};

const normalizeLicenseFile = (file = {}) => {
  if (!file || !file.data) {
    return {
      fileName: "",
      mimeType: "",
      data: "",
      uploadedAt: null,
    };
  }

  const fileName = String(file.fileName || "driving-license").slice(0, 120);
  const mimeType = String(file.mimeType || "").slice(0, 80);
  const data = String(file.data || "");

  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];

  if (!allowedMimeTypes.includes(mimeType)) {
    throw new Error("Driving license must be JPG, PNG, WEBP, or PDF");
  }

  if (!data.startsWith("data:")) {
    throw new Error("Invalid driving license file");
  }

  const approxBytes = Math.ceil((data.length * 3) / 4);

  if (approxBytes > 2 * 1024 * 1024) {
    throw new Error("Driving license file must be below 2MB");
  }

  return {
    fileName,
    mimeType,
    data,
    uploadedAt: new Date(),
  };
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

const deliveryApplicationReceivedHtml = (application) => `
  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
    <h2 style="color:#fb641b">Wearlance Delivery Partner Application Received</h2>
    <p>Hello <strong>${application.name}</strong>,</p>
    <p>Thank you for applying to become a Wearlance Delivery Partner.</p>
    <p>Your application is now under admin verification.</p>
    <div style="padding:14px;border-radius:12px;background:#f8fafc;border:1px solid #e5e7eb">
      <p><strong>Status:</strong> Pending Verification</p>
      <p><strong>City:</strong> ${application.city}</p>
      <p><strong>Vehicle:</strong> ${application.vehicleType}</p>
    </div>
    <p>You can download your application confirmation PDF from your Wearlance account.</p>
    <p>Regards,<br/>Wearlance Team</p>
  </div>
`;

const deliveryApprovalHtml = (application) => `
  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
    <h2 style="color:#16a34a">Congratulations from Wearlance</h2>
    <p>Hello <strong>${application.name}</strong>,</p>
    <p>Your Wearlance Delivery Partner application has been approved.</p>
    <div style="padding:14px;border-radius:12px;background:#ecfdf5;border:1px solid #bbf7d0">
      <p><strong>Status:</strong> Approved</p>
      <p><strong>City:</strong> ${application.city}</p>
      <p><strong>Vehicle:</strong> ${application.vehicleType}</p>
    </div>
    <p>You can now access the Delivery Dashboard and accept assigned delivery work.</p>
    <p>Please maintain customer trust, privacy, and professional behavior.</p>
    <p>Regards,<br/>Wearlance Team</p>
  </div>
`;

const drawCertificatePdf = ({ res, partner, type }) => {
  const isApproval = type === "approval";
  const title = isApproval
    ? "DELIVERY PARTNER APPROVAL CERTIFICATE"
    : "DELIVERY APPLICATION CONFIRMATION";
  const subtitle = isApproval
    ? "Official approval document"
    : "Application received document";
  const fileName = isApproval
    ? `wearlance-delivery-approval-${String(partner._id).slice(-8)}.pdf`
    : `wearlance-delivery-application-${String(partner._id).slice(-8)}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  const doc = new PDFDocument({ size: "A4", margin: 0 });
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const left = 50;
  const contentWidth = pageWidth - left * 2;
  const navy = "#111827";
  const orange = "#ff9900";
  const blueGray = "#334155";
  const muted = "#64748b";
  const border = "#e2e8f0";
  const success = "#16a34a";
  const warning = "#fb641b";

  // Header
  doc.rect(0, 0, pageWidth, 122).fill(navy);
  doc.fillColor(orange).font("Helvetica-Bold").fontSize(30).text("WEARLANCE", left, 30);
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("Every Style Rs. 399  •  Delivery Partner Program", left, 66);
  doc
    .fillColor("#cbd5e1")
    .font("Helvetica")
    .fontSize(9)
    .text(subtitle, left, 86);

  // Title area
  let y = 150;
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(19).text(title, left, y, {
    width: contentWidth,
    align: "center",
  });

  y += 42;
  const bodyText = isApproval
    ? `This certificate confirms that ${partner.name} has been approved as a Wearlance Delivery Partner after admin verification.`
    : `This document confirms that ${partner.name} has submitted an application to become a Wearlance Delivery Partner. The application is currently under verification.`;

  doc.fillColor(blueGray).font("Helvetica").fontSize(11).text(bodyText, left + 25, y, {
    width: contentWidth - 50,
    align: "center",
    lineGap: 5,
  });

  // Details card
  y = 255;
  const cardX = left;
  const cardY = y;
  const cardW = contentWidth;
  const cardH = 235;

  doc.roundedRect(cardX, cardY, cardW, cardH, 16).fillAndStroke("#ffffff", border);
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(13).text("Applicant Details", cardX + 26, cardY + 24);

  const labelX = cardX + 28;
  const valueX = cardX + 155;
  let rowY = cardY + 62;
  const rowGap = 25;

  const addRow = (label, value) => {
    doc.fillColor(muted).font("Helvetica-Bold").fontSize(10).text(label, labelX, rowY, {
      width: 105,
    });
    doc.fillColor(navy).font("Helvetica").fontSize(10).text(String(value || "Not provided"), valueX, rowY, {
      width: cardW - 185,
      ellipsis: true,
    });
    rowY += rowGap;
  };

  addRow("Name", partner.name);
  addRow("Email", partner.email);
  addRow("Phone", partner.phone);
  addRow("City", `${partner.city}${partner.state ? `, ${partner.state}` : ""}`);
  addRow("Vehicle Type", partner.vehicleType);
  addRow("License", partner.drivingLicense?.fileName ? "Uploaded" : "Not uploaded");
  addRow("Status", String(partner.status || "pending").toUpperCase());

  if (partner.noDrivingLicenseReason) {
    doc
      .fillColor(muted)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("No-license reason", labelX, rowY, { width: 120 });
    doc
      .fillColor(navy)
      .font("Helvetica")
      .fontSize(10)
      .text(partner.noDrivingLicenseReason, valueX, rowY, {
        width: cardW - 185,
        lineGap: 3,
      });
  }

  // Status note
  y = cardY + cardH + 38;
  doc.fillColor(isApproval ? success : warning).font("Helvetica-Bold").fontSize(14).text(
    isApproval
      ? "Congratulations. You are approved for the Wearlance Delivery Partner Program."
      : "Thank you for applying. Verification is currently in progress.",
    left + 25,
    y,
    {
      width: contentWidth - 50,
      align: "center",
      lineGap: 5,
    }
  );

  y += 58;
  doc.fillColor(muted).font("Helvetica").fontSize(9).text(`Generated on: ${new Date().toLocaleString("en-IN")}`, left, y, {
    width: contentWidth,
    align: "center",
  });
  doc.text(`Reference ID: ${partner._id}`, left, y + 14, {
    width: contentWidth,
    align: "center",
  });

  // Footer
  doc.moveTo(left, pageHeight - 78).lineTo(pageWidth - left, pageHeight - 78).strokeColor(border).lineWidth(1).stroke();
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(10).text("Wearlance Admin", left, pageHeight - 60, {
    width: contentWidth,
    align: "right",
  });
  doc.fillColor(muted).font("Helvetica").fontSize(8).text("Computer generated document. No physical signature required.", left, pageHeight - 45, {
    width: contentWidth,
    align: "right",
  });

  doc.end();
};

const adminCreateDeliveryInvite = async (req, res) => {
  try {
    if (!isWearlanceAdmin(req.user)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const email = normalizeEmail(req.body.email);

    if (!email || !email.includes("@")) {
      return res.status(400).json({ success: false, message: "Valid email is required" });
    }

    const invite = await DeliveryAccessInvite.findOneAndUpdate(
      { email },
      {
        email,
        status: "active",
        invitedBy: req.user._id,
        note: req.body.note || "",
        revokedAt: null,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await sendEmail({
      to: email,
      subject: "Wearlance Delivery Partner Access Enabled",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Wearlance Delivery Access</h2><p>Your email has been enabled to apply as a Wearlance Delivery Partner.</p><p>Please login with this email and submit your application from the Delivery Partner page.</p></div>`,
    });

    res.status(200).json({ success: true, message: "Delivery access email added", invite });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const adminListDeliveryInvites = async (req, res) => {
  try {
    if (!isWearlanceAdmin(req.user)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const invites = await DeliveryAccessInvite.find({})
      .populate("invitedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, invites });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const adminRemoveDeliveryInvite = async (req, res) => {
  try {
    if (!isWearlanceAdmin(req.user)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const invite = await DeliveryAccessInvite.findById(req.params.id);

    if (!invite) {
      return res.status(404).json({ success: false, message: "Invite not found" });
    }

    invite.status = "revoked";
    invite.revokedAt = new Date();
    await invite.save();

    res.status(200).json({ success: true, message: "Delivery access email removed", invite });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const applyAsDeliveryPartner = async (req, res) => {
  try {
    const { phone, city, state, pincode, vehicleType, experience, drivingLicense, noDrivingLicenseReason } = req.body;
    const userEmail = normalizeEmail(req.user.email);

    const invite = await DeliveryAccessInvite.findOne({
      email: userEmail,
      status: "active",
    });

    if (!invite) {
      return res.status(403).json({
        success: false,
        message: "Your email is not enabled for delivery partner application. Please contact admin.",
      });
    }

    if (!phone || !city) {
      return res.status(400).json({
        success: false,
        message: "Phone and city are required to apply as delivery partner",
      });
    }

    const hasLicenseUpload = Boolean(drivingLicense && drivingLicense.data);
    const reasonText = String(noDrivingLicenseReason || "").trim();

    if (!hasLicenseUpload && reasonText.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Upload driving license or provide a clear reason for not uploading it",
      });
    }

    let normalizedLicense = {
      fileName: "",
      mimeType: "",
      data: "",
      uploadedAt: null,
    };

    if (hasLicenseUpload) {
      normalizedLicense = normalizeLicenseFile(drivingLicense);
    }

    const existingApplication = await DeliveryPartner.findOne({ user: req.user._id });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: `You already have a delivery application with status: ${existingApplication.status}`,
        application: existingApplication,
      });
    }

    const application = await DeliveryPartner.create({
      user: req.user._id,
      name: req.user.name || "Wearlance User",
      email: userEmail,
      phone,
      city,
      state: state || "",
      pincode: pincode || "",
      vehicleType: vehicleType || "Bike",
      experience: experience || "",
      drivingLicense: normalizedLicense,
      noDrivingLicenseReason: hasLicenseUpload ? "" : reasonText,
      status: "pending",
      isActive: false,
    });

    await writeDeliveryLog({
      req,
      deliveryPartner: application._id,
      action: "DELIVERY_APPLICATION_SUBMITTED",
      result: "success",
      note: `${application.email} applied as delivery partner`,
    });

    await sendEmail({
      to: application.email,
      subject: "Wearlance Delivery Partner Application Received",
      html: deliveryApplicationReceivedHtml(application),
    });

    res.status(201).json({
      success: true,
      message: "Delivery partner application submitted. Confirmation email sent.",
      application,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


const withdrawMyDeliveryApplication = async (req, res) => {
  try {
    const application = await DeliveryPartner.findOne({ user: req.user._id });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "No delivery application found",
      });
    }

    if (application.status === "approved") {
      return res.status(400).json({
        success: false,
        message: "Approved delivery access cannot be withdrawn here. Please contact admin.",
      });
    }

    if (application.status === "withdrawn") {
      return res.status(400).json({
        success: false,
        message: "Application is already withdrawn",
      });
    }

    application.status = "withdrawn";
    application.isActive = false;
    application.withdrawnBy = req.user._id;
    application.withdrawnAt = new Date();
    application.withdrawReason = req.body.reason || "Withdrawn by applicant";

    await application.save();

    await writeDeliveryLog({
      req,
      deliveryPartner: application._id,
      action: "DELIVERY_APPLICATION_WITHDRAWN",
      result: "success",
      note: application.withdrawReason,
    });

    res.status(200).json({
      success: true,
      message: "Delivery application withdrawn successfully",
      application,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMyDeliveryApplication = async (req, res) => {
  try {
    const application = await DeliveryPartner.findOne({ user: req.user._id });
    const accessInvite = await DeliveryAccessInvite.findOne({ email: normalizeEmail(req.user.email), status: "active" });

    res.status(200).json({
      success: true,
      application,
      canApply: Boolean(accessInvite),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const listDeliveryApplications = async (req, res) => {
  try {
    if (!isWearlanceAdmin(req.user)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const status = req.query.status || "";
    const filter = status ? { status } : {};

    const applications = await DeliveryPartner.find(filter)
      .populate("user", "name email")
      .populate("approvedBy", "name email")
      .populate("rejectedBy", "name email")
      .populate("suspendedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, applications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const approveDeliveryPartner = async (req, res) => {
  try {
    if (!isWearlanceAdmin(req.user)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const partner = await DeliveryPartner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({ success: false, message: "Delivery partner application not found" });
    }

    partner.status = "approved";
    partner.isActive = true;
    partner.approvedBy = req.user._id;
    partner.approvedAt = new Date();
    partner.rejectedBy = null;
    partner.rejectedAt = null;
    partner.suspendedBy = null;
    partner.suspendedAt = null;

    await partner.save();

    await writeDeliveryLog({
      req,
      deliveryPartner: partner._id,
      action: "DELIVERY_PARTNER_APPROVED",
      result: "success",
      note: `${partner.email} approved as delivery partner`,
    });

    await sendEmail({
      to: partner.email,
      subject: "Congratulations - Wearlance Delivery Partner Approved",
      html: deliveryApprovalHtml(partner),
    });

    res.status(200).json({
      success: true,
      message: "Delivery partner approved successfully. Congratulations email sent.",
      partner,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const rejectDeliveryPartner = async (req, res) => {
  try {
    if (!isWearlanceAdmin(req.user)) return res.status(403).json({ success: false, message: "Admin access required" });
    const partner = await DeliveryPartner.findById(req.params.id);
    if (!partner) return res.status(404).json({ success: false, message: "Delivery partner application not found" });
    partner.status = "rejected";
    partner.isActive = false;
    partner.rejectedBy = req.user._id;
    partner.rejectedAt = new Date();
    await partner.save();
    await writeDeliveryLog({ req, deliveryPartner: partner._id, action: "DELIVERY_PARTNER_REJECTED", result: "success", note: req.body.reason || "Application rejected by admin" });
    res.status(200).json({ success: true, message: "Delivery partner rejected", partner });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const suspendDeliveryPartner = async (req, res) => {
  try {
    if (!isWearlanceAdmin(req.user)) return res.status(403).json({ success: false, message: "Admin access required" });
    const partner = await DeliveryPartner.findById(req.params.id);
    if (!partner) return res.status(404).json({ success: false, message: "Delivery partner not found" });
    partner.status = "suspended";
    partner.isActive = false;
    partner.activeSessionId = "";
    partner.suspendedBy = req.user._id;
    partner.suspendedAt = new Date();
    await partner.save();
    await writeDeliveryLog({ req, deliveryPartner: partner._id, action: "DELIVERY_PARTNER_SUSPENDED", result: "success", note: req.body.reason || "Delivery partner suspended by admin" });
    res.status(200).json({ success: true, message: "Delivery partner suspended", partner });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const reactivateDeliveryPartner = async (req, res) => {
  try {
    if (!isWearlanceAdmin(req.user)) return res.status(403).json({ success: false, message: "Admin access required" });
    const partner = await DeliveryPartner.findById(req.params.id);
    if (!partner) return res.status(404).json({ success: false, message: "Delivery partner not found" });
    partner.status = "approved";
    partner.isActive = true;
    partner.suspendedBy = null;
    partner.suspendedAt = null;
    await partner.save();
    await writeDeliveryLog({ req, deliveryPartner: partner._id, action: "DELIVERY_PARTNER_REACTIVATED", result: "success", note: "Delivery partner reactivated by admin" });
    res.status(200).json({ success: true, message: "Delivery partner reactivated", partner });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getDeliveryLogs = async (req, res) => {
  try {
    if (!isWearlanceAdmin(req.user)) return res.status(403).json({ success: false, message: "Admin access required" });
    const logs = await DeliveryActionLog.find({})
      .populate("actor", "name email")
      .populate("deliveryPartner", "name email phone city status")
      .populate("order", "_id orderStatus paymentStatus totalPrice")
      .sort({ createdAt: -1 })
      .limit(150);
    res.status(200).json({ success: true, logs });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const downloadDeliveryCertificate = async (req, res) => {
  try {
    const type = req.params.type;
    const partner = await DeliveryPartner.findById(req.params.id).populate("user", "name email");

    if (!partner) return res.status(404).json({ success: false, message: "Delivery application not found" });

    const isOwner = String(partner.user?._id || partner.user) === String(req.user._id);
    const isAdmin = isWearlanceAdmin(req.user);

    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: "Not allowed to download this PDF" });

    if (type === "approval" && partner.status !== "approved") {
      return res.status(400).json({ success: false, message: "Approval PDF is available only after approval" });
    }

    if (!["application", "approval"].includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid certificate type" });
    }

    drawCertificatePdf({ res, partner, type });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createDeliverySession = async (req, user) => {
  const partner = await DeliveryPartner.findOne({ user: user._id, status: "approved", isActive: true });
  if (!partner) return null;
  const sessionId = crypto.randomBytes(32).toString("hex");
  partner.activeSessionId = sessionId;
  partner.lastLoginAt = new Date();
  partner.lastLoginIp = getRequestIp(req);
  partner.lastLoginDevice = getRequestDevice(req);
  await partner.save();
  return { partner, sessionId };
};

module.exports = {
  adminCreateDeliveryInvite,
  adminListDeliveryInvites,
  adminRemoveDeliveryInvite,
  applyAsDeliveryPartner,
  withdrawMyDeliveryApplication,
  getMyDeliveryApplication,
  listDeliveryApplications,
  approveDeliveryPartner,
  rejectDeliveryPartner,
  suspendDeliveryPartner,
  reactivateDeliveryPartner,
  getDeliveryLogs,
  downloadDeliveryCertificate,
  createDeliverySession,
};
