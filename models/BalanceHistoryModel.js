const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BalanceHistorySchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      // required: true,
      ref: "User",
    },
    type: {
      type: String,
    },
    amountSpentInUsd: {
      type: Number,
      required: true,
    },
    txInfo: {
      type: [Schema.Types.Mixed]
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

var BalanceHistory = mongoose.model("BalanceHistory", BalanceHistorySchema);
module.exports = BalanceHistory;