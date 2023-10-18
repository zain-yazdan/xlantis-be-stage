const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const orderListingSchema = new Schema({
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
		// required: true,
	},
	// This variable should be renamed to availableSupply, it
	supply: {
		type: Number,
		min: 1,
		required: true
	},
	totalSupplyOnSale: {
		type: Number,
		min: 1,
		required: true		
	},
	supplySold: {
		type: Number,
		default: 0
	},
	price: {
		type: String,
		// required: true,
	},
	isSold: {
		type: Boolean,
		default: false,
	},
	soldAt: {
		type: Date,
		default: null,
	},
	txHash: {
		type: String,
		default: "",
	},
	startTime: {
		type: Date,
	},
	endTime: {
		type: Date,
	},
	saleType: {
		type: String,
		enum: ["fixed-price", "auction"],
	},
	isFeatured:{
		type : Boolean,
		default: false
	}
});

var orderListingModel = mongoose.model("OrderListing", orderListingSchema);
module.exports = orderListingModel;
