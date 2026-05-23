const mongoose = require("mongoose");

const deliveryPartnerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    state: {
      type: String,
      default: "",
      trim: true,
    },

    pincode: {
      type: String,
      default: "",
      trim: true,
    },

    vehicleType: {
      type: String,
      enum: ["Bike", "Scooter", "Bicycle", "Car", "Walking", "Other"],
      default: "Bike",
    },

    experience: {
      type: String,
      default: "",
      trim: true,
    },

    drivingLicense: {
      fileName: {
        type: String,
        default: "",
        trim: true,
      },
      mimeType: {
        type: String,
        default: "",
        trim: true,
      },
      data: {
        type: String,
        default: "",
      },
      uploadedAt: {
        type: Date,
        default: null,
      },
    },

    noDrivingLicenseReason: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended", "withdrawn"],
      default: "pending",
      index: true,
    },

    isActive: {
      type: Boolean,
      default: false,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    suspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    suspendedAt: {
      type: Date,
      default: null,
    },

    withdrawnBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    withdrawnAt: {
      type: Date,
      default: null,
    },

    withdrawReason: {
      type: String,
      default: "",
      trim: true,
    },

    activeSessionId: {
      type: String,
      default: "",
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    lastLoginIp: {
      type: String,
      default: "",
    },

    lastLoginDevice: {
      type: String,
      default: "",
    },

    totalAssigned: {
      type: Number,
      default: 0,
    },

    totalDelivered: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("DeliveryPartner", deliveryPartnerSchema);
