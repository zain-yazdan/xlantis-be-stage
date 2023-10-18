const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TopUpSchema = new Schema({
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
	},
	amountInUSD: {
        type: Number,
	},
	amountInMatic: {
        type: String,
	},
    date: {
        type: Date,
        default: Date.now()
    }
});

var TopUpModel = mongoose.model("TopUp", TopUpSchema);
module.exports = TopUpModel;
