const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const KeyValueSchema = new Schema({
  key: {
    type: String,
    required: true,
  },
  // value: {
  // 	type: String,
  // 	// required: true,
  // },
  type: {
    type: String,
    required: true,
  },
});

const NFTPropertiesSchema = new Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: {
    type: String,
    required: true,
    // unique: true,
  },
  properties: {
    type: [KeyValueSchema],
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  userType: {
    type: String,
    enum: ["admin", "super-admin"],
    required: true,
  },
});

var NFTProperties = mongoose.model("NFTProperties", NFTPropertiesSchema);
module.exports = NFTProperties;
