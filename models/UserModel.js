const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  xmannaUserId: {
    type: String,
  },
  stripeAccountId: {
    type: String,
  },
  username: {
    type: String,
    required: true,
  },
  bio: {
    type: String,
  },
  email: {
    type: String,
    // required: true,
    // unique: true
  },
  password: {
    type: String,
  },
  role: {
    type: String,
    enum: ["user", "admin", "super-admin"],
    required: true,
  },
  imageURL: {
    type: String,
  },
  bannerURL: {
    type: String,
  },
  domain: {
    type: String,
  },
  companyName: {
    type: String,
  },
  designation: {
    type: String,
  },
  industryType: {
    type: String,
  },
  reasonForInterest: {
    type: String,
  },
  isTxPending: {
    type: Boolean,
    default: false,
  },
  walletAddress: {
    type: String,
    // required: true,
    // unique: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  isEnabled: {
    type: Boolean,
    default: false,
  },
  isInfoAdded: {
    type: Boolean,
    default: false,
  },
  userType: {
    type: String,
    enum: ["v1", "v2"],
    required: true,
  },
  isEmailNotificationEnabled: {
    type: Boolean,
    default: true,
  },
  isPushNotificationEnabled: {
    type: Boolean,
    default: true,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  marketplaceImage: {
    type: String,
  },
  estimationCloneAddress: {
    type: String,
  }
});

var Users = mongoose.model("User", UserSchema);
module.exports = Users;
