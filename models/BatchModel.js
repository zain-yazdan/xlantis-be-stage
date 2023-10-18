const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const batchSchema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  nftIds: {
    type: [mongoose.Schema.Types.ObjectId],
    required: true,
    ref: "NFT",
  },
  collectionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Collection",
  },
  txHash: {
    type: String,
    default: "",
    // unique: true
  },
  isMintedOnBlockChain: {
    type: Boolean,
    default: false,
  },
  isBatchCreated: {
		type: Boolean,
		default: false
	}
});

const batchModel = mongoose.model("BatchMint", batchSchema);
module.exports = batchModel;
