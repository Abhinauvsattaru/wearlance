const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

dotenv.config();

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const orderRoutes = require("./routes/orderRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const deliveryRoutes = require("./routes/deliveryRoutes");

const {
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
} = require("./middleware/securityMiddleware");

const app = express();

const validateCriticalEnv = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.warn("⚠️ SECURITY WARNING: JWT_SECRET should be at least 32 characters.");
  }

  if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_URL) {
    console.warn("⚠️ SECURITY WARNING: FRONTEND_URL is missing in production.");
  }
};

validateCriticalEnv();

// DATABASE
connectDB();

// SECURITY FOUNDATION
app.set("trust proxy", 1);
app.disable("x-powered-by");

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://wearlance.vercel.app",
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
].filter(Boolean);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "https:"],
        "connect-src": ["'self'", ...allowedOrigins],
        "frame-ancestors": ["'none'"],
      },
    },
  })
);

app.use(requestId);
app.use(securityAuditLogger);
app.use(securityHeaders);
app.use(validateRequestShape);
app.use(blockBadContentTypes);
app.use(blockSuspiciousUserAgents);
app.use(blockSuspiciousPaths);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked this origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// MIDDLEWARES
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true, limit: "4mb" }));
app.use(cookieParser());
app.use(sanitizeRequest);
app.use(generalLimiter);

// API HOME
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Wearlance API</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #131921, #2874f0, #ec4899);
            color: white;
          }

          .card {
            background: rgba(255,255,255,0.12);
            border: 1px solid rgba(255,255,255,0.25);
            padding: 40px;
            border-radius: 24px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.35);
            width: min(920px, 92vw);
          }

          h1 {
            font-size: 42px;
            margin-bottom: 10px;
          }

          p {
            font-size: 18px;
            opacity: 0.9;
          }

          code {
            display: block;
            background: rgba(0,0,0,0.3);
            padding: 12px;
            border-radius: 12px;
            margin-top: 14px;
          }
        </style>
      </head>

      <body>
        <div class="card">
          <h1>WEARLANCE API Running 🚀</h1>
          <p>Every Style ₹399 · Backend Connected · Security Phase 2 Hardened · COD Beta</p>
          <code>Environment: ${process.env.NODE_ENV || "development"}</code>
          <code>Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}</code>
          <code>Security: Helmet + strict CORS + layered rate limits + request firewall + NoSQL sanitization</code>
          <code>GET /api/products</code>
          <code>POST /api/delivery/apply</code>
          <code>GET /api/delivery/me</code>
          <code>GET /api/delivery/admin/applications</code>
          <code>PUT /api/delivery/admin/:id/approve</code>
          <code>PUT /api/delivery/admin/:id/reject</code>
          <code>PUT /api/delivery/admin/:id/suspend</code>
          <code>PUT /api/delivery/admin/:id/reactivate</code>
          <code>GET /api/delivery/admin/logs</code>
          <code>POST /api/orders</code>
          <code>PUT /api/orders/:id/cancel</code>
          <code>PUT /api/orders/:id/return</code>
          <code>PUT /api/orders/:id/verify-delivery</code>
          <code>POST /api/reviews</code>
          <code>POST /api/payments/create-order</code>
          <code>POST /api/payments/verify</code>
          <code>GET /api/invoices/:orderId/download</code>
        </div>
      </body>
    </html>
  `);
});

// ROUTES
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/products", readLimiter, productRoutes);
app.use("/api/upload", uploadLimiter, uploadRoutes);
app.use("/api/orders", orderLimiter, orderRoutes);
app.use("/api/reviews", orderLimiter, reviewRoutes);
app.use("/api/payments", paymentDisabled, paymentLimiter, paymentRoutes);
app.use("/api/invoices", readLimiter, invoiceRoutes);
app.use("/api/delivery/admin", adminLimiter);
app.use("/api/delivery", orderLimiter, deliveryRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// ERROR HANDLER
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err.message);

  const isProduction = process.env.NODE_ENV === "production";

  res.status(err.statusCode || 500).json({
    success: false,
    message: isProduction ? "Server error. Please try again." : err.message,
  });
});

// SERVER
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
