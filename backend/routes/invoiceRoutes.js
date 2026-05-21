const express = require("express");

const { downloadInvoice } = require("../controllers/invoiceController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/:orderId/download", protect, downloadInvoice);

module.exports = router;