var express = require("express");
var router = express.Router();
const Web3 = require("web3");
var web3 = new Web3();
web3.setProvider(process.env.WEB_SOCKET);
const UserModel = require("../../models/UserModel");
const auth = require("../../middlewares/auth");
const { convertMaticInUsd } = require("../../actions/crypto-convert");

const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});

router
  .route("/funds")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async (req, res, next) => {
      try {
        var balance = await web3.eth.getBalance(req.user.walletAddress);
        const etherValue = web3.utils.fromWei(balance, "ether");
        const balanceInUsd = await convertMaticInUsd(etherValue);

        return res.status(200).json({
          success: true,
          maticBalance: parseFloat(etherValue),
          balanceInUsd
        });
      } catch (error) {
        console.log("error (try-catch) : " + error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    }
  );

router
  .route("/toggle-email-notifications")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async (req, res, next) => {
      try {
        await UserModel.findById(req.user._id, {
          isEmailNotificationEnabled: !req.user.isEmailNotificationEnabled,
        });

        response = {
          success: true,
          message:
            req.user.isEmailNotificationEnabled === true
              ? "Email notification disabled"
              : "Email notification enabled",
        };

        return res.status(200).json(response);
      } catch (error) {
        console.log("error (try-catch) : " + error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    }
  );

module.exports = router;
