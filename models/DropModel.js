const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const dropSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    marketplaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Marketplace",
    },
    title: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    dropCloneAddress: {
      type: String,
      default: "",
    },
    startTime: {
      type: Date,
      // required: true,
    },
    endTime: {
      type: Date,
      // required: true,
    },
    totalNFTs: {
      type: Number,
      default: 0,
    },
    totalNFTsSold: {
      type: Number,
      default: 0,
    },
    NFTIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "NFT",
    },
    isCreatedOnBlockchain: {
      type: Boolean,
      default: false,
    },
    txHash: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["draft", "pending", "active", "closed"],
      default: "draft",
    },
    saleType: {
      type: String,
      enum: ["fixed-price", "auction"],
      required: true,
    },
    dropType: {
      type: String,
      enum: ["721", "1155"],
      required: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isFeaturedSuperAdmin: {
      type: Boolean,
      default: false,
    },
    bannerURL: {
      type: String,
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Category",
      // enum: ["Meta Racers", "Digital Memberships", "App Downloads", "Mystery Boxes", "Land Plots", "Avatars"]
    },
    isTxFailed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

var dropModel = mongoose.model("Drop", dropSchema);
module.exports = dropModel;
