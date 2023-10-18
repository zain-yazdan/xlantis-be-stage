const { number } = require("meeko");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// const ownersData = new Schema({
// 	ownerId: {
// 		type: mongoose.Schema.Types.ObjectId,
// 		required: true,
// 		ref: 'User',
// 	},
// 	supply:{
// 		type: Number,
// 		required: true
// 	}
// })

const nftSchema = new Schema({
	minterId: {
		type: mongoose.Schema.Types.ObjectId,
		required: true,
		ref: "User",
	},
	ownerId: {
		type: mongoose.Schema.Types.ObjectId,
		required: true,
		ref: "User",
	},
	// owners:{
	// 	type: [ownersData],
	// 	required: true
	// },
	collectionId: {
		type: mongoose.Schema.Types.ObjectId,
		required: true,
		ref: "Collection",
	},
	batchId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "BatchMint",
	},
	dropId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Drop",
		default: null,
	},
	currentOrderListingId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "OrderListing",
	},
	marketplaceId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Marketplace",
	},
	nftId: {
		type: String,
	},
	title: {
		type: String,
		required: true,
	},
	description: {
		type: String,
	},
	type: {
		type: String,
		enum: ["Mastercraft", "Common", "Rare", "Epic", "Legendary", "Uncommon"],
	},
	nftFormat: {
		type: String,
		required: true,
	},
	tokenSupply: {
		type: Number,
	},
	supplyType: {
		type: String,
		enum: ["Single", "Variable"],
	},
	mintingType: {
		type: String,
		enum: ["simple-mint", "batch-mint", "lazy-mint"],
		required: true,
	},
	nftURI: {
		type: String,
		// unique: true,
		required: true,
	},
	previewImageURI: {
		type: String,
	},
	metadataURI: {
		type: String,
		// unique: true,
		required: true,
	},
	txHash: {
		type: String,
		default: "",
	},
	isMinted: {
		type: Boolean,
		default: false,
	},
	properties: {
		type: Schema.Types.Mixed,
	},
	voucherSignature: {
		type: String,
	},
	rank: {
		type: Number,
		default: 0,
	},
	isOnSale: {
		type: Boolean,
		default: false,
	},
	totalSupply:{
		type: Number,
	},
	rarity: {
		type: String,
		enum: ["Common", "Uncommon", "Rare", "Epic", "Legendary"],
	},
	isBatchCreated: {
		type: Boolean,
		default: false
	}
});

var NftModel = mongoose.model("NFT", nftSchema);
module.exports = NftModel;
