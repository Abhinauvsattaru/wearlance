const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

const TRUSTED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

const getClientIp = (req) => {
  return (
    req.headers["cf-connecting-ip"] ||
    req.headers["x-real-ip"] ||
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
};

const createLimiter = ({
  windowMs,
  max,
  message,
  skipSuccessfulRequests = false,
}) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => {
      console.warn(
        `[SECURITY] Rate limit blocked ${req.method} ${req.originalUrl} ip=${getClientIp(req)} requestId=${req.id || "-"}`
      );

      res.status(429).json({
        success: false,
        message,
        requestId: req.id,
      });
    },
  });
};

const generalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: "Too many requests. Please wait and try again.",
});

const readLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 900,
  message: "Too many read requests. Please wait and try again.",
});

const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: "Too many login/signup attempts. Please wait and try again.",
});

const otpLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 6,
  message: "Too many OTP attempts. Please wait and try again.",
});

const orderLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 45,
  message: "Too many order requests. Please wait and try again.",
});

const adminLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: "Too many admin requests. Please wait and try again.",
});

const uploadLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many upload attempts. Please wait and try again.",
});

const paymentLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: "Too many payment attempts. Please wait and try again.",
});

const requestId = (req, res, next) => {
  req.id = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
};

const securityAuditLogger = (req, res, next) => {
  const started = Date.now();

  res.on("finish", () => {
    const status = res.statusCode;

    if (status >= 400 || req.securityFlagged) {
      console.warn(
        `[SECURITY] ${status} ${req.method} ${req.originalUrl} ip=${getClientIp(req)} requestId=${req.id} ms=${Date.now() - started}`
      );
    }
  });

  next();
};

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

  if (typeof value === "string") {
    return value.replace(/\u0000/g, "").trim();
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

  if (req.query && typeof req.query === "object") {
    req.query = sanitizeDeep(req.query);
  }

  next();
};

const suspiciousUserAgentPatterns = [
  "sqlmap",
  "nikto",
  "acunetix",
  "nessus",
  "masscan",
  "zgrab",
  "dirbuster",
  "gobuster",
  "wpscan",
  "hydra",
  "havij",
  "nuclei",
];

const blockSuspiciousUserAgents = (req, res, next) => {
  const userAgent = String(req.headers["user-agent"] || "").toLowerCase();

  const isSuspicious = suspiciousUserAgentPatterns.some((pattern) =>
    userAgent.includes(pattern)
  );

  if (isSuspicious) {
    req.securityFlagged = true;
    return res.status(403).json({
      success: false,
      message: "Request blocked",
      requestId: req.id,
    });
  }

  next();
};

const suspiciousPathPatterns = [
  /\.\./,
  /\/etc\/passwd/i,
  /wp-admin/i,
  /wp-login/i,
  /phpmyadmin/i,
  /\.env/i,
  /config\.json/i,
  /backup/i,
  /dump/i,
  /<script/i,
  /union(\s|%20)+select/i,
  /sleep\(/i,
  /benchmark\(/i,
];

const blockSuspiciousPaths = (req, res, next) => {
  const target = `${req.originalUrl || ""} ${JSON.stringify(req.query || {})}`.toLowerCase();

  const suspicious = suspiciousPathPatterns.some((pattern) =>
    pattern.test(target)
  );

  if (suspicious) {
    req.securityFlagged = true;
    return res.status(403).json({
      success: false,
      message: "Suspicious request blocked",
      requestId: req.id,
    });
  }

  next();
};

const validateRequestShape = (req, res, next) => {
  if (!TRUSTED_METHODS.includes(req.method)) {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
      requestId: req.id,
    });
  }

  if ((req.originalUrl || "").length > 2048) {
    return res.status(414).json({
      success: false,
      message: "Request URL too long",
      requestId: req.id,
    });
  }

  next();
};

const blockBadContentTypes = (req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const contentType = String(req.headers["content-type"] || "").toLowerCase();

    if (
      contentType &&
      !contentType.includes("application/json") &&
      !contentType.includes("multipart/form-data") &&
      !contentType.includes("application/x-www-form-urlencoded")
    ) {
      return res.status(415).json({
        success: false,
        message: "Unsupported content type",
        requestId: req.id,
      });
    }
  }

  next();
};

const paymentDisabled = (req, res, next) => {
  if (process.env.ENABLE_ONLINE_PAYMENTS === "true") {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Online payments are temporarily disabled. COD is currently available.",
    requestId: req.id,
  });
};

const securityHeaders = (req, res, next) => {
  res.setHeader("X-App-Name", "Wearlance");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  next();
};

module.exports = {
  generalLimiter,
  readLimiter,
  authLimiter,
  otpLimiter,
  orderLimiter,
  adminLimiter,
  uploadLimiter,
  paymentLimiter,
  requestId,
  securityAuditLogger,
  sanitizeRequest,
  blockSuspiciousUserAgents,
  blockSuspiciousPaths,
  validateRequestShape,
  blockBadContentTypes,
  paymentDisabled,
  securityHeaders,
};
