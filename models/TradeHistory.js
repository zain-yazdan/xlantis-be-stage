const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TradeHistorySchema = new Schema(
  {
    nftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NFT",
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    soldAt: {
      type: Date,
      required: true,
    },
    saleType: {
      type: String,
      enum: ["fixed-price", "auction"],
      required: true,
    },
    supply:{
        type: Number
    },
    unitPrice:{
      type: Number,
      required: true
    }
},
// {
//     timestamps: {createdAt: true, updatedAt: true}
// }
);

var TradeHistory = mongoose.model("TradeHistory", TradeHistorySchema);
module.exports = TradeHistory;
