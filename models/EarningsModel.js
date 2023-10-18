const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const EarningsSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    nftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NFT",
    },
    type: {
      type: String,
      enum: ["nft-sold", "platform-fee", "royalty-fee"],
      required: true,
    },
    // currentBalance: {
    //     type: Number,
    //     required: true,
    // },
    amount: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

var Earnings = mongoose.model("Earnings", EarningsSchema);
module.exports = Earnings;
