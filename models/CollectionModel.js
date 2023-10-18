const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const collectionSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    nftId: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "NFT",
    },
    nftContractAddress: {
      type: String,
      default: "",
    },
    currentOrderListingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrderListing",
    },
    marketplaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Marketplace",
    },
    dropId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drop",
      default: null,
    },
    cloneId: {
      type: String,
      //required: false,
    },
    name: {
      type: String,
      required: true,
    },
    symbol: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: mongoose.Schema.Types.String,
      required: true,
    },
    banner: {
      type: mongoose.Schema.Types.String,
    },
    description: {
      type: String,
      required: true,
    },
    txHash: {
      type: String,
      //required: false,
    },
    contractType: {
      type: String,
      enum: ["721", "1155"],
      //required: false,
    },
    isDeployed: {
      type: Boolean,
      default: false,
      required: true,
    },
    isAuctionDropVerified: {
      type: Boolean,
      default: false,
    },
    isFixedPriceDropVerified: {
      type: Boolean,
      default: false,
    },
    isSuperAdminApproved: {
      type: Boolean,
      default: false,
    },
    royaltyFee: {
      type: Number,
      default: 0,
    },
    isOnSale: {
      type: Boolean,
      default: false,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Category",
      // enum: ["Meta Racers", "Digital Memberships", "App Downloads", "Mystery Boxes", "Land Plots", "Avatars"]
    }
  },
  {
    timestamps: true,
  }
);

var collectionModel = mongoose.model("Collection", collectionSchema);
module.exports = collectionModel;
