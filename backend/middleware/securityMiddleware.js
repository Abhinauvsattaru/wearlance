const rateLimit = require("express-rate-limit");

const createLimiter = ({ windowMs, max, message }) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message,
    },
  });
};

const generalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 450,
  message: "Too many requests. Please wait and try again.",
});

const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 45,
  message: "Too many login/signup attempts. Please wait and try again.",
});

const otpLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 12,
  message: "Too many OTP attempts. Please wait and try again.",
});

const paymentLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: "Too many payment attempts. Please wait and try again.",
});

const dangerousKeyPattern = /(^\$)|(\.)|(__proto__)|(constructor)|(prototype)/i;

const sanitizeDeep = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item));
  }

  if (value && typeof value === "object") {
    const cleanObject = {};

    for (const [key, childValue] of Object.entries(value)) {
      if (dangerousKeyPattern.test(key)) {
        continue;
      }

      cleanObject[key] = sanitizeDeep(childValue);
    }

    return cleanObject;
  }

  return value;
};

const sanitizeRequest = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeDeep(req.body);
  }

  if (req.params && typeof req.params === "object") {
    req.params = sanitizeDeep(req.params);
  }

  next();
};

const blockSuspiciousUserAgents = (req, res, next) => {
  const userAgent = String(req.headers["user-agent"] || "").toLowerCase();

  const blockedPatterns = [
    "sqlmap",
    "nikto",
    "acunetix",
    "nessus",
    "masscan",
    "zgrab",
  ];

  const isSuspicious = blockedPatterns.some((pattern) =>
    userAgent.includes(pattern)
  );

  if (isSuspicious) {
    return res.status(403).json({
      success: false,
      message: "Request blocked",
    });
  }

  next();
};

const securityHeaders = (req, res, next) => {
  res.setHeader("X-App-Name", "Wearlance");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(self)"
  );

  next();
};

module.exports = {
  generalLimiter,
  authLimiter,
  otpLimiter,
  paymentLimiter,
  sanitizeRequest,
  blockSuspiciousUserAgents,
  securityHeaders,
};
