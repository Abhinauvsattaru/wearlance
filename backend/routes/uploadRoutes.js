const express = require("express");

const upload = require("../middleware/uploadMiddleware");

const {
  uploadImageToCloudinary,
} = require("../controllers/uploadController");

const {
  protect,
  adminOnly,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
  "/image",
  protect,
  adminOnly,
  upload.single("image"),
  uploadImageToCloudinary
);

module.exports = router;