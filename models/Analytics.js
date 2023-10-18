const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const analyticsSchema = new Schema(
  {
    dropId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drop",
    },
    nftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NFT",
    },
    viewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    viewedAt: {
      type: Date,
    },
    viewDuration: {
      type: String,
    },
    timesSold: {
      type: Number,
    },
    soldAt: {
      type: Number,
    },
    saleDuration: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

var analyticsModel = mongoose.model("Analytics", analyticsSchema);
module.exports = analyticsModel;
