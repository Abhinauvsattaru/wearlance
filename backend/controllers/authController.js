const User = require("../models/User");
const crypto = require("crypto");
const DeliveryPartner = require("../models/DeliveryPartner");
const DeliveryActionLog = require("../models/DeliveryActionLog");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");
const { otpTemplate } = require("../utils/emailTemplates");

const ADMIN_EMAILS = [
  "abhinauv22@gmail.com",
  "abhinauvo5s@gmail.com",
  "fordealpen@gmail.com",
];

const generateToken = (id, extraPayload = {}) => {
  return jwt.sign({ id, ...extraPayload }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const safeUser = (user, extra = {}) => {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    isVerified: user.isVerified,
    ...extra,
  };
};


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

const writeDeliverySecurityLog = async ({
  req,
  user,
  partner = null,
  action,
  result = "info",
  note = "",
}) => {
  try {
    await DeliveryActionLog.create({
      deliveryPartner: partner?._id || partner || null,
      actor: user?._id || req.user?._id,
      action,
      result,
      note,
      ip: getRequestIp(req),
      device: getRequestDevice(req),
    });
  } catch (error) {
    console.error("Delivery security log failed:", error.message);
  }
};

const sendOtpToUser = async (user, subjectText) => {
  const otp = generateOtp();

  user.otp = otp;
  user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  const emailResult = await sendEmail({
    to: user.email,
    subject: subjectText,
    html: otpTemplate({
      name: user.name,
      otp,
    }),
  });

  if (!emailResult.success) {
    throw new Error(emailResult.message || "OTP email could not be sent");
  }

  return otp;
};

// SIGNUP: SEND OTP, DO NOT LOGIN YET
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    let user = await User.findOne({ email: cleanEmail });

    if (user && user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "User already exists. Please login.",
      });
    }

    const isAdmin = ADMIN_EMAILS.includes(cleanEmail);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (!user) {
      user = await User.create({
        name,
        email: cleanEmail,
        password: hashedPassword,
        isAdmin,
        isVerified: false,
      });
    } else {
      user.name = name;
      user.password = hashedPassword;
      user.isAdmin = isAdmin;
      user.isVerified = false;
      await user.save();
    }

    await sendOtpToUser(user, "Verify your Wearlance account");

    res.status(200).json({
      success: true,
      requiresOtp: true,
      flow: "signup",
      message: "OTP sent to your email. Please verify to complete signup.",
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// LOGIN: DIRECT LOGIN, NO OTP

const sendDeliveryLoginOtp = async ({ req, user, partner }) => {
  const otp = generateOtp();

  partner.loginOtp = otp;
  partner.loginOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
  partner.loginOtpAttempts = 0;
  await partner.save();

  const emailResult = await sendEmail({
    to: user.email,
    subject: "Wearlance Delivery Login OTP",
    html: otpTemplate({
      name: user.name,
      otp,
    }),
  });

  const emailSuccess =
    emailResult === true ||
    emailResult?.success === true ||
    emailResult?.accepted === true;

  if (!emailSuccess) {
    await writeDeliverySecurityLog({
      req,
      user,
      partner,
      action: "DELIVERY_LOGIN_OTP_SEND_FAILED",
      result: "failed",
      note: emailResult?.message || "Delivery login OTP email could not be sent",
    });

    throw new Error(emailResult?.message || "Delivery login OTP email could not be sent");
  }

  await writeDeliverySecurityLog({
    req,
    user,
    partner,
    action: "DELIVERY_LOGIN_OTP_SENT",
    result: "success",
    note: "Delivery login OTP sent",
  });

  return otp;
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isVerified) {
      await sendOtpToUser(user, "Verify your Wearlance account");

      return res.status(403).json({
        success: false,
        requiresOtp: true,
        flow: "signup",
        email: user.email,
        message:
          "Your account is not verified. OTP has been sent to your email.",
      });
    }

    const shouldBeAdmin = ADMIN_EMAILS.includes(cleanEmail);

    if (user.isAdmin !== shouldBeAdmin) {
      user.isAdmin = shouldBeAdmin;
      await user.save();
    }

    const deliveryPartner = await DeliveryPartner.findOne({
      user: user._id,
      status: "approved",
      isActive: true,
    });

    if (deliveryPartner && !user.isAdmin) {
      await sendDeliveryLoginOtp({ req, user, partner: deliveryPartner });

      return res.status(200).json({
        success: false,
        requiresDeliveryOtp: true,
        flow: "delivery-login",
        email: user.email,
        message: "Delivery partner security OTP sent to your email.",
      });
    }

    res.status(200).json({
      success: true,
      message: user.isAdmin ? "Admin login successful" : "Login successful",
      user: safeUser(user),
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


const verifyDeliveryLoginOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and delivery OTP are required",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail });

    if (!user || !user.isVerified) {
      return res.status(401).json({
        success: false,
        message: "Delivery account not found or not verified",
      });
    }

    const partner = await DeliveryPartner.findOne({
      user: user._id,
      status: "approved",
      isActive: true,
    });

    if (!partner) {
      return res.status(403).json({
        success: false,
        message: "Delivery access is not active for this account",
      });
    }

    if (!partner.loginOtp || !partner.loginOtpExpires) {
      return res.status(400).json({
        success: false,
        message: "No delivery login OTP found. Please login again.",
      });
    }

    if (new Date() > partner.loginOtpExpires) {
      partner.loginOtp = null;
      partner.loginOtpExpires = null;
      await partner.save();

      await writeDeliverySecurityLog({
        req,
        user,
        partner,
        action: "DELIVERY_LOGIN_OTP_EXPIRED",
        result: "failed",
        note: "Delivery login OTP expired",
      });

      return res.status(400).json({
        success: false,
        message: "Delivery login OTP expired. Please login again.",
      });
    }

    if (String(partner.loginOtp) !== String(otp)) {
      partner.loginOtpAttempts = (partner.loginOtpAttempts || 0) + 1;
      await partner.save();

      await writeDeliverySecurityLog({
        req,
        user,
        partner,
        action: "DELIVERY_LOGIN_OTP_INVALID",
        result: "failed",
        note: `Invalid delivery login OTP attempt ${partner.loginOtpAttempts}`,
      });

      if (partner.loginOtpAttempts >= 5) {
        partner.status = "suspended";
        partner.isActive = false;
        partner.activeSessionId = "";
        partner.sessionExpiresAt = null;
        partner.disabledReason = "Too many invalid delivery login OTP attempts";
        await partner.save();

        return res.status(403).json({
          success: false,
          message: "Delivery account suspended due to too many invalid OTP attempts.",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid delivery login OTP",
      });
    }

    const sessionId = crypto.randomBytes(32).toString("hex");
    const sessionHours = Math.min(
      Math.max(Number(partner.sessionDurationHours || process.env.DELIVERY_SESSION_HOURS || 8), 1),
      24
    );
    const sessionExpiresAt = new Date(Date.now() + sessionHours * 60 * 60 * 1000);

    partner.loginOtp = null;
    partner.loginOtpExpires = null;
    partner.loginOtpAttempts = 0;
    partner.activeSessionId = sessionId;
    partner.sessionExpiresAt = sessionExpiresAt;
    partner.lastLoginAt = new Date();
    partner.lastLoginIp = getRequestIp(req);
    partner.lastLoginDevice = getRequestDevice(req);
    await partner.save();

    await writeDeliverySecurityLog({
      req,
      user,
      partner,
      action: "DELIVERY_LOGIN_SUCCESS",
      result: "success",
      note: `Delivery session created until ${sessionExpiresAt.toISOString()}`,
    });

    res.status(200).json({
      success: true,
      message: "Delivery login verified successfully",
      user: safeUser(user, {
        isDeliveryPartner: true,
        deliveryPartnerStatus: partner.status,
      }),
      deliverySessionExpiresAt: sessionExpiresAt,
      token: generateToken(user._id, {
        deliverySessionId: sessionId,
        deliveryPartnerId: String(partner._id),
      }),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deliveryLogout = async (req, res) => {
  try {
    const partner = await DeliveryPartner.findOne({ user: req.user._id });

    if (partner) {
      partner.activeSessionId = "";
      partner.sessionExpiresAt = null;
      await partner.save();

      await writeDeliverySecurityLog({
        req,
        user: req.user,
        partner,
        action: "DELIVERY_LOGOUT",
        result: "success",
        note: "Delivery session cleared",
      });
    }

    res.status(200).json({
      success: true,
      message: "Delivery session logged out",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// VERIFY OTP FOR SIGNUP
const verifySignupOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.otp || !user.otpExpires) {
      return res.status(400).json({
        success: false,
        message: "No OTP found. Please signup again.",
      });
    }

    if (new Date() > user.otpExpires) {
      user.otp = null;
      user.otpExpires = null;
      await user.save();

      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new OTP.",
      });
    }

    if (String(user.otp) !== String(otp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;

    const shouldBeAdmin = ADMIN_EMAILS.includes(cleanEmail);
    user.isAdmin = shouldBeAdmin;

    await user.save();

    res.status(200).json({
      success: true,
      message: user.isAdmin
        ? "Admin account verified successfully"
        : "Account verified successfully",
      user: safeUser(user),
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// RESEND SIGNUP OTP
const resendSignupOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Account already verified. Please login.",
      });
    }

    await sendOtpToUser(user, "Verify your Wearlance account");

    res.status(200).json({
      success: true,
      requiresOtp: true,
      flow: "signup",
      message: "New signup OTP sent to your email",
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// FORGOT PASSWORD: SEND OTP
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email",
      });
    }

    await sendOtpToUser(user, "Wearlance password reset OTP");

    res.status(200).json({
      success: true,
      requiresOtp: true,
      flow: "forgot-password",
      message: "Password reset OTP sent to your email",
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// RESET PASSWORD WITH OTP
const resetPasswordWithOtp = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.otp || !user.otpExpires) {
      return res.status(400).json({
        success: false,
        message: "No OTP found. Please request forgot password again.",
      });
    }

    if (new Date() > user.otpExpires) {
      user.otp = null;
      user.otpExpires = null;
      await user.save();

      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new OTP.",
      });
    }

    if (String(user.otp) !== String(otp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.otp = null;
    user.otpExpires = null;
    user.isVerified = true;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successful. Please login with new password.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getMe = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      user: safeUser(req.user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyDeliveryLoginOtp,
  deliveryLogout,
  verifySignupOtp,
  resendSignupOtp,
  forgotPassword,
  resetPasswordWithOtp,
  getMe,
};
