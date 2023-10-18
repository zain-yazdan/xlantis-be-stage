const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BlockchainTransactionSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    txHash: {
      type: String,
      required: true,
    },
    receipt: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    txFeeInUsd: {
      type: Number,
      required: true,
    },
    txFeeInWei: {
      type: String,
      required: true,
    },
    // transaction reciever
    to: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

var blockchainTransaction = mongoose.model(
  "BlockchainTransaction",
  BlockchainTransactionSchema
);
module.exports = blockchainTransaction;
