const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const StripeEventsSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

var StripeEventsModel = mongoose.model("stripe-events", StripeEventsSchema);
module.exports = StripeEventsModel;
