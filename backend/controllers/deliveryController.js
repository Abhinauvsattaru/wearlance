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
  const fileName = isApproval
    ? `wearlance-delivery-approval-${String(partner._id).slice(-8)}.pdf`
    : `wearlance-delivery-application-${String(partner._id).slice(-8)}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  doc.pipe(res);

  doc.rect(0, 0, doc.page.width, 116).fill("#111827");
  doc.fillColor("#ff9900").fontSize(28).font("Helvetica-Bold").text("WEARLANCE", 48, 36);
  doc.fillColor("#ffffff").fontSize(11).text("Every Style ₹399 · Delivery Partner Program", 48, 70);

  doc.moveDown(4);
  doc.fillColor("#111827").fontSize(20).font("Helvetica-Bold").text(title, { align: "center" });
  doc.moveDown(1);

  doc.fontSize(12).font("Helvetica").fillColor("#334155");
  const bodyText = isApproval
    ? `This certificate confirms that ${partner.name} has been approved as a Wearlance Delivery Partner after admin verification.`
    : `This document confirms that ${partner.name} has submitted an application to become a Wearlance Delivery Partner. The application is currently under verification.`;
  doc.text(bodyText, { align: "center", lineGap: 5 });

  doc.moveDown(2);
  doc.roundedRect(70, doc.y, 455, 180, 14).strokeColor("#e5e7eb").lineWidth(1).stroke();
  const startY = doc.y + 22;
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(12).text("Applicant Details", 95, startY);
  doc.font("Helvetica").fontSize(11).fillColor("#334155");
  doc.text(`Name: ${partner.name}`, 95, startY + 32);
  doc.text(`Email: ${partner.email}`, 95, startY + 56);
  doc.text(`Phone: ${partner.phone}`, 95, startY + 80);
  doc.text(`City: ${partner.city}${partner.state ? `, ${partner.state}` : ""}`, 95, startY + 104);
  doc.text(`Vehicle Type: ${partner.vehicleType}`, 95, startY + 128);
  doc.text(`Status: ${partner.status.toUpperCase()}`, 95, startY + 152);

  doc.y = startY + 210;
  doc.fillColor(isApproval ? "#16a34a" : "#fb641b").font("Helvetica-Bold").fontSize(14);
  doc.text(isApproval ? "Congratulations and welcome to Wearlance." : "Thank you for applying. Verification is in progress.", { align: "center" });

  doc.moveDown(2);
  doc.fillColor("#64748b").font("Helvetica").fontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleString("en-IN")}`, { align: "center" });
  doc.text(`Reference ID: ${partner._id}`, { align: "center" });

  doc.moveDown(3);
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(11).text("Wearlance Admin", { align: "right" });
  doc.fillColor("#64748b").font("Helvetica").fontSize(9).text("Computer generated document", { align: "right" });

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
    const { phone, city, state, pincode, vehicleType, experience } = req.body;
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
