const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");

dotenv.config();

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const orderRoutes = require("./routes/orderRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");

const app = express();

// DATABASE
connectDB();

// MIDDLEWARES
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(cookieParser());

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

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
  })
);

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
          <p>Every Style ₹399 · Backend Connected</p>
          <code>Environment: ${process.env.NODE_ENV || "development"}</code>
          <code>Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}</code>
          <code>GET /api/products</code>
          <code>PUT /api/products/:id</code>
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
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/invoices", invoiceRoutes);

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

  res.status(500).json({
    success: false,
    message: err.message || "Server error",
  });
});

// SERVER
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
