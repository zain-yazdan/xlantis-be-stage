const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const raritySchema = new Schema({
  collectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Collection",
    required: true,
  },
  rarities: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
});

const RarityModel = mongoose.model("Rarity", raritySchema);
module.exports = RarityModel;
