const crypto = require("crypto");

const DeliveryPartner = require("../models/DeliveryPartner");
const DeliveryActionLog = require("../models/DeliveryActionLog");

const ADMIN_EMAILS = [
  "abhinauv22@gmail.com",
  "abhinauvo5s@gmail.com",
  "fordealpen@gmail.com",
];

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
  const email = String(user?.email || "").toLowerCase();

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

const applyAsDeliveryPartner = async (req, res) => {
  try {
    const { phone, city, state, pincode, vehicleType, experience } = req.body;

    if (!phone || !city) {
      return res.status(400).json({
        success: false,
        message: "Phone and city are required to apply as delivery partner",
      });
    }

    const existingApplication = await DeliveryPartner.findOne({
      user: req.user._id,
    });

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
      email: req.user.email,
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

    res.status(201).json({
      success: true,
      message: "Delivery partner application submitted. Admin approval is required.",
      application,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getMyDeliveryApplication = async (req, res) => {
  try {
    const application = await DeliveryPartner.findOne({
      user: req.user._id,
    });

    res.status(200).json({
      success: true,
      application,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const listDeliveryApplications = async (req, res) => {
  try {
    if (!isWearlanceAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const status = req.query.status || "";

    const filter = status ? { status } : {};

    const applications = await DeliveryPartner.find(filter)
      .populate("user", "name email")
      .populate("approvedBy", "name email")
      .populate("rejectedBy", "name email")
      .populate("suspendedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      applications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const approveDeliveryPartner = async (req, res) => {
  try {
    if (!isWearlanceAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const partner = await DeliveryPartner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Delivery partner application not found",
      });
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

    res.status(200).json({
      success: true,
      message: "Delivery partner approved successfully",
      partner,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const rejectDeliveryPartner = async (req, res) => {
  try {
    if (!isWearlanceAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const partner = await DeliveryPartner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Delivery partner application not found",
      });
    }

    partner.status = "rejected";
    partner.isActive = false;
    partner.rejectedBy = req.user._id;
    partner.rejectedAt = new Date();

    await partner.save();

    await writeDeliveryLog({
      req,
      deliveryPartner: partner._id,
      action: "DELIVERY_PARTNER_REJECTED",
      result: "success",
      note: req.body.reason || "Application rejected by admin",
    });

    res.status(200).json({
      success: true,
      message: "Delivery partner rejected",
      partner,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const suspendDeliveryPartner = async (req, res) => {
  try {
    if (!isWearlanceAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const partner = await DeliveryPartner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Delivery partner not found",
      });
    }

    partner.status = "suspended";
    partner.isActive = false;
    partner.activeSessionId = "";
    partner.suspendedBy = req.user._id;
    partner.suspendedAt = new Date();

    await partner.save();

    await writeDeliveryLog({
      req,
      deliveryPartner: partner._id,
      action: "DELIVERY_PARTNER_SUSPENDED",
      result: "success",
      note: req.body.reason || "Delivery partner suspended by admin",
    });

    res.status(200).json({
      success: true,
      message: "Delivery partner suspended",
      partner,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const reactivateDeliveryPartner = async (req, res) => {
  try {
    if (!isWearlanceAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const partner = await DeliveryPartner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Delivery partner not found",
      });
    }

    partner.status = "approved";
    partner.isActive = true;
    partner.suspendedBy = null;
    partner.suspendedAt = null;

    await partner.save();

    await writeDeliveryLog({
      req,
      deliveryPartner: partner._id,
      action: "DELIVERY_PARTNER_REACTIVATED",
      result: "success",
      note: "Delivery partner reactivated by admin",
    });

    res.status(200).json({
      success: true,
      message: "Delivery partner reactivated",
      partner,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getDeliveryLogs = async (req, res) => {
  try {
    if (!isWearlanceAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const logs = await DeliveryActionLog.find({})
      .populate("actor", "name email")
      .populate("deliveryPartner", "name email phone city status")
      .populate("order", "_id orderStatus paymentStatus totalPrice")
      .sort({ createdAt: -1 })
      .limit(150);

    res.status(200).json({
      success: true,
      logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const createDeliverySession = async (req, user) => {
  const partner = await DeliveryPartner.findOne({
    user: user._id,
    status: "approved",
    isActive: true,
  });

  if (!partner) {
    return null;
  }

  const sessionId = crypto.randomBytes(32).toString("hex");

  partner.activeSessionId = sessionId;
  partner.lastLoginAt = new Date();
  partner.lastLoginIp = getRequestIp(req);
  partner.lastLoginDevice = getRequestDevice(req);

  await partner.save();

  return {
    partner,
    sessionId,
  };
};

module.exports = {
  applyAsDeliveryPartner,
  getMyDeliveryApplication,
  listDeliveryApplications,
  approveDeliveryPartner,
  rejectDeliveryPartner,
  suspendDeliveryPartner,
  reactivateDeliveryPartner,
  getDeliveryLogs,
  createDeliverySession,
};
