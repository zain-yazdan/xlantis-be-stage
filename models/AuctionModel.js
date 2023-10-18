const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const auctionSchema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  tokenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Token",
  },
  auctionId: {
    type: Number,
  },
  expiresAt: {
    type: String,
  },
  salePrice: {
    type: Number,
  },
  auctionStartsAt: {
    type: String,
  },
  auctionEndsAt: {
    type: String,
  },
  minimumBid: {
    type: Number,
  },
  bidDelta: {
    type: Number,
  },
  check: {
    type: String,
  },
});

var auctionModel = mongoose.model("Auction", auctionSchema);
module.exports = auctionModel;
