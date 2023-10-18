const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const cartSchema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  dropId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Drop",
  },
  collectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Collection",
    required: true,
  },
  nftId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "NFT",
    required: true,
  },
  orderListingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "NFT",
    required: true,
  },
});

var cartModel = mongoose.model("Cart", cartSchema);
module.exports = cartModel;
