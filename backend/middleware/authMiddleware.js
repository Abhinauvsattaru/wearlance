const jwt = require("jsonwebtoken");
const User = require("../models/User");
const DeliveryPartner = require("../models/DeliveryPartner");

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    req.user = user;
    req.auth = decoded;
    req.deliverySessionId = decoded.deliverySessionId || "";
    req.deliveryPartnerId = decoded.deliveryPartnerId || "";
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized. Invalid token.",
    });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "Admin access only",
    });
  }
};

const deliveryPartnerOnly = async (req, res, next) => {
  try {
    const partner = await DeliveryPartner.findOne({
      user: req.user._id,
      status: "approved",
      isActive: true,
    });

    if (!partner) {
      return res.status(403).json({
        success: false,
        message: "Approved delivery partner access only",
      });
    }

    if (!req.deliverySessionId || partner.activeSessionId !== req.deliverySessionId) {
      return res.status(401).json({
        success: false,
        message: "Delivery session expired or replaced. Please login again.",
      });
    }

    if (!partner.sessionExpiresAt || new Date() > partner.sessionExpiresAt) {
      partner.activeSessionId = "";
      partner.sessionExpiresAt = null;
      await partner.save();

      return res.status(401).json({
        success: false,
        message: "Delivery session expired. Please login again.",
      });
    }

    req.deliveryPartner = partner;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Delivery session verification failed",
    });
  }
};

module.exports = {
  protect,
  adminOnly,
  deliveryPartnerOnly,
};