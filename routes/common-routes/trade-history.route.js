var express = require("express");
var router = express.Router();

const auth = require("../../middlewares/auth");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});

const TradeHistoryModel = require("../../models/TradeHistory");

router
  .route("/trade/:nftId")
  .get(
    async function (req, res, next) {
      try {
        const history = await TradeHistoryModel.find({
          nftId: req.params.nftId,
        }).populate({
          path: "sellerId",
          select: "walletAddress"
        }).populate({
          path: "buyerId",
          select: "walletAddress"
        });;

        return res.status(200).json({
          success: true,
          history,
        });
      } catch (error) {
        console.log("catch-error : ", error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    }
  );

module.exports = router;
