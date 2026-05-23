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

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/apply", protect, applyAsDeliveryPartner);
router.put("/withdraw", protect, withdrawMyDeliveryApplication);
router.get("/me", protect, getMyDeliveryApplication);
router.get("/certificate/:type/:id", protect, downloadDeliveryCertificate);

router.get("/admin/invites", protect, adminListDeliveryInvites);
router.post("/admin/invites", protect, adminCreateDeliveryInvite);
router.delete("/admin/invites/:id", protect, adminRemoveDeliveryInvite);

router.get("/admin/applications", protect, listDeliveryApplications);
router.put("/admin/:id/approve", protect, approveDeliveryPartner);
router.put("/admin/:id/reject", protect, rejectDeliveryPartner);
router.put("/admin/:id/suspend", protect, suspendDeliveryPartner);
router.put("/admin/:id/reactivate", protect, reactivateDeliveryPartner);
router.put("/admin/:id/session-settings", protect, updateDeliverySessionSettings);
router.put("/admin/:id/force-logout", protect, forceDeliveryLogout);
router.get("/admin/logs", protect, getDeliveryLogs);

module.exports = router;
