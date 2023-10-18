const { number } = require('meeko');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ownerSchema = new Schema({
	ownerId: {
		type: mongoose.Schema.Types.ObjectId,
		required: true,
		ref: 'User',
	},
	nftId:{
		type: mongoose.Schema.Types.ObjectId,
		ref : "NFT",
		required: true
	},
	supply:{
		type: Number,
		required: true
	}
})

var NftOwnersDataModel = mongoose.model('NFTOwnersData', ownerSchema);
module.exports = NftOwnersDataModel;
