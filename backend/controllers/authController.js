const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");
const { otpTemplate } = require("../utils/emailTemplates");

const ADMIN_EMAILS = [
  "abhinauv22@gmail.com",
  "abhinauvo5s@gmail.com",
  "fordealpen@gmail.com",
];

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const safeUser = (user) => {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    isVerified: user.isVerified,
  };
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
  verifySignupOtp,
  resendSignupOtp,
  forgotPassword,
  resetPasswordWithOtp,
  getMe,
};