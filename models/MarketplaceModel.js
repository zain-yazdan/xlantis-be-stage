const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const MarketplaceSchema = new Schema({
  adminId:{
    type: mongoose.Schema.Types.ObjectId,
    required: true, 
    ref: "User"
  },
  domain: {
    required: true, 
    type: String,
  },
  companyName: {
    type: String,
  },
  industryType: {
    type: String,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  marketplaceImage: {
    type: String,
  },
  logoImage:{
    type: String,
  },
  description: {
    type: String
  },
  website: {
    type: String,
    trim: true,
  },
  twitter: {
    type: String,
    trim: true,
  },
  discord: {
    type: String,
    trim: true,
  },
  facebook: {
    type: String,
    trim: true,
  },
  instagram: {
    type: String,
    trim: true,
  },
});

const MarketplaceModel = mongoose.model("Marketplace", MarketplaceSchema);
module.exports = MarketplaceModel;