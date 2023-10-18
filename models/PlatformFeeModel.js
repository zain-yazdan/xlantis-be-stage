const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PlatformFeeRequestSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    platformFee: {
      type: Number,
      required: true,
    },
    isAccepted: {
      type: String,
      enum: ["accepted", "pending", "rejected", "expired"],
      default: "pending",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

var PlatformFeeRequests = mongoose.model(
  "PlatformFeeRequest",
  PlatformFeeRequestSchema
);
module.exports = PlatformFeeRequests;
