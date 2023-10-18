const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ConnectedUsersSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "V2-User",
    },
    socketId: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

var connectedUsers = mongoose.model("ConnectedUser", ConnectedUsersSchema);
module.exports = connectedUsers;
