const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bidSchema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  nftId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "NFT",
  },
  bidAmount: {
    type: String,
    required: true,
  },
  bidTime: {
    type: Date,
    required: true,
  },
  expiryTime: {
    type: Date,
    required: true,
  },
  // The address of person who placed the bid
  bidderAddress: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "active", "expired"],
    default: "pending",
  },
  isHighestBid: {
    type: Boolean,
    required: true,
  },
  bidFinalizationTxHash: {
    type: String,
    default: "",
  },
  isAccepted: {
    type: Boolean,
    default: false,
  },
  bidAcceptionTxHash: {
    type: String,
    deafult: "",
  },
});

const bidModel = mongoose.model("Bid", bidSchema);
module.exports = bidModel;
