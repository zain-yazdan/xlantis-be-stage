const connectedUsersModel = require("../models/ConnectedUser");
// const server = require('../bin/www');
// const io = require("socket.io")(server);

var io;

async function init(_io) {
  io = _io;
  io.on("connection", (socket) => {
    console.log("Socket Id: ", socket.id);

    socket.on("user-logged-in", async (userId) => {
      console.log("Socket UserId: ", userId);
      const connectedUsers = await connectedUsersModel.create({
        userId: userId,
        socketId: socket.id,
      });
      console.log("Connected Users: ", connectedUsers);
    });

    socket.on("user-logged-out", async (userId) => {
      const connectedUsers = await connectedUsersModel.deleteOne({
        userId: userId,
      });
      // console.log("Connected Users: ",connectedUsers)
    });

    socket.on("disconnect", async (reason) => {
      const connectedUsers = await connectedUsersModel.deleteOne({
        socketId: socket.id,
      });
      console.log("Disconnect Reason: ", connectedUsers);
    });
  });
}

async function sendNotification(notification) {
  const user = await connectedUsersModel.findOne({
    userId: notification.userId,
  });
  if (user) {
    console.log("User:", user.socketId);
    io.to(user.socketId).emit("Notification", notification);
  } else {
    return null;
  }
}
//io.listen(5000);

async function togglePushNotifications(userId) {
  const user = await UserModel.findById(userId);
  if (!user) {
    return null;
  }
  await user.updateOne({
    isPushNotificationEnabled: !user.isPushNotificationEnabled,
  });
  message =
    user.isPushNotificationEnabled === true
      ? "Push notification disabled"
      : "Push notification enabled";
  console.log(message);
}

module.exports.sendNotification = sendNotification;
module.exports.togglePushNotifications = togglePushNotifications;
module.exports.init = init;
