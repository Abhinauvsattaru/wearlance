const express = require("express");

const {
  adminCreateDeliveryInvite,
  adminListDeliveryInvites,
  adminRemoveDeliveryInvite,
  applyAsDeliveryPartner,
  withdrawMyDeliveryApplication,
  getMyDeliveryApplication,
  listDeliveryApplications,
  approveDeliveryPartner,
  rejectDeliveryPartner,
  suspendDeliveryPartner,
  reactivateDeliveryPartner,
  updateDeliverySessionSettings,
  forceDeliveryLogout,
  getDeliveryLogs,
  downloadDeliveryCertificate,
} = require("../controllers/deliveryController");

const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/apply", protect, applyAsDeliveryPartner);
router.put("/withdraw", protect, withdrawMyDeliveryApplication);
router.get("/me", protect, getMyDeliveryApplication);
router.get("/certificate/:type/:id", protect, downloadDeliveryCertificate);

router.get("/admin/invites", protect, adminOnly, adminListDeliveryInvites);
router.post("/admin/invites", protect, adminOnly, adminCreateDeliveryInvite);
router.delete("/admin/invites/:id", protect, adminOnly, adminRemoveDeliveryInvite);

router.get("/admin/applications", protect, adminOnly, listDeliveryApplications);
router.put("/admin/:id/approve", protect, adminOnly, approveDeliveryPartner);
router.put("/admin/:id/reject", protect, adminOnly, rejectDeliveryPartner);
router.put("/admin/:id/suspend", protect, adminOnly, suspendDeliveryPartner);
router.put("/admin/:id/reactivate", protect, adminOnly, reactivateDeliveryPartner);
router.put("/admin/:id/session-settings", protect, adminOnly, updateDeliverySessionSettings);
router.put("/admin/:id/force-logout", protect, adminOnly, forceDeliveryLogout);
router.get("/admin/logs", protect, adminOnly, getDeliveryLogs);

module.exports = router;
