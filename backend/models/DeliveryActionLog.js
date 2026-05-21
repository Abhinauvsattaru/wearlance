const mongoose = require("mongoose");

const deliveryActionLogSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },

    deliveryPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryPartner",
      default: null,
      index: true,
    },

    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    result: {
      type: String,
      enum: ["success", "failed", "info"],
      default: "info",
    },

    note: {
      type: String,
      default: "",
      trim: true,
    },

    ip: {
      type: String,
      default: "",
    },

    device: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("DeliveryActionLog", deliveryActionLogSchema);
