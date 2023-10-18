const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const USDSchema = new Schema({
	ownerId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		// required: true,
	},
	buyerId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		// required: true,
	},
	nftId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "NFT",
		// required: true,
	},
	orderListingId:{
		type: mongoose.Schema.Types.ObjectId
	},
	topupRequesterUserId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
	},
	checkoutSessionId: {
		type: String,
		required: true,
	},
	status:{
		type: String,
		enum: ["pending", "success", "expired", "failed"],
		default: "pending"
	},
	paymentMode:{
		type: String,
		enum: ["admin-topup","nft-purchase"],
		required: true,
	},
	supply: {
		type: Number
	},
	errorMessage:{
		type: String
	},
	idempotencyKey:{
		type: String,
		required: true,
		unique: true
	},
	isExecuted:{
		type: Boolean,
		required: true,
		default: false
	}
},{
	timestamps: { createdAt: true, updatedAt: true }
});

var USDModel = mongoose.model("USDDepositRequest", USDSchema);
module.exports = USDModel;
