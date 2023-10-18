const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const categorySchema = new Schema(
  {
    name: {
      type: String,
      unique: true,
    },
    imageUrl: {
      type: String,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

var categoryModel = mongoose.model("Category", categorySchema);
module.exports = categoryModel;
