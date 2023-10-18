const UserModel = require("../models/UserModel");
const checkIsProfileAdded =
  (...roles) =>
  async (req, res, next) => {
    if (!req.user) {
      return res.status(401).send("user not found.");
    }

    const hasRole = roles.find((role) => req.user.role === role);

    if (!hasRole) {
      return next();
    }

    let userData = await UserModel.findById(req.user._id);

    if (!userData) {
      return res.status(401).send("User not found in the DB.");
    }

    if (userData.isVerified == false || userData.isEnabled == false) {
      return res
        .status(400)
        .send(
          "User is not verified, Please add profile data if not added yet."
        );
    }

    return next();
  };

module.exports.checkIsProfileAdded = checkIsProfileAdded;
