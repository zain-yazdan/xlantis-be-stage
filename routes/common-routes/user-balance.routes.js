var express = require("express");
var router = express.Router();
const Web3 = require("web3");
var web3 = new Web3();
web3.setProvider(process.env.WEB_SOCKET);
const UserModel = require("../../models/UserModel");
const auth = require("../../middlewares/auth");
const { convertMaticInUsd } = require("../../actions/crypto-convert");
const axios = require("axios");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});

router
  .route("/balances")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async (req, res, next) => {
      try {
        console.log('getting user account from polygon-api...');
        let xmannaUser = await axios.get(
          `${process.env.POLYGON_API_URL}/account/${req.user.xmannaUserId}`,
          {
            headers: {
              "User-Agent":
                "LoyaltyApp/NFTMarket/1.0.0 (iOS Mozilla Firefox 99.0.4844.51 Ubuntu)",
              Authorization: `Basic ${process.env.XMANNA_BASIC_AUTH_TOKEN}`,
              "X-API-KEY": process.env.XMANNA_POLYGON_API_KEY,
            },
          }
        );
        xmannaUser = xmannaUser.data.body;

        // dollar balance
        const polygonBalanceInWei = xmannaUser.fiatBalance.usd.balance;
        const polygonBalanceInMatic = Web3.utils.fromWei(polygonBalanceInWei, "ether");

        // wallet balance
        var walletBalanceInWei = await web3.eth.getBalance(req.user.walletAddress);
        const walletBalanceInMatic = web3.utils.fromWei(walletBalanceInWei, "ether");
        const walletBalanceInUsd = await convertMaticInUsd(walletBalanceInMatic);

        return res.status(200).json({
          success: true,
          usdBalance :{
            InUsd: polygonBalanceInMatic
          },
          walletBalance:{
            InWei: walletBalanceInWei,
            InMatic: parseFloat(walletBalanceInMatic),
            InUsd: walletBalanceInUsd
          }
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

module.exports = router;
