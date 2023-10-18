var express = require("express");
var router = express.Router();

const auth = require("../../middlewares/auth");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});

const EarningsModel = require("../../models/EarningsModel");

router
  .route("/")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin", "super-admin"),
    async function (req, res, next) {
      try {
        const earnings = await EarningsModel.find({
          userId: req.user._id,
        });

        let sum = 0;
        for (let i = 0; i < earnings.length; i++) {
          sum += earnings[i].amount;
        }
        return res.status(200).json({
          success: true,
          totalEarnings: sum,
          earnings,
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

router
  .route("/list")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin", "super-admin"),
    async function (req, res, next) {
      try {
        const earnings = await EarningsModel.find({
          userId: req.user._id,
        }).select("amount createdAt");

        return res.status(200).json({
          success: true,
          earnings,
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


  router
  .route("/super-admin")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        const result = await EarningsModel.aggregate([
          { $match: { userId: req.user._id, type: 'platform-fee' } },
          { $group: { _id: null, earnings: { $sum: '$amount' } } }
        ]);

        if (result.length == 0) {
          return res.status(200).json({
            success: true,
            message: "super-admin has no earnings"
          });  
        }

        let earnings = result[0].earnings;
        earnings = earnings / 100
        
        return res.status(200).json({
          success: true,
          earnings
        });
      } catch (error) {
        console.log("error (try-catch) : " + error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
  });

router
  .route("/admin")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin"),
    async function (req, res, next) {
      try {
        const result = await EarningsModel.aggregate([
          {
            $match: {
              userId: req.user._id,
              type: { $in: ["nft-sold", "royalty-fee"] }
            }
          },
          {
            $group: {
              _id: "$type",
              totalAmount: { $sum: "$amount" }
            }
          }
        ]);
        
        if (result.length == 0) {
          return res.status(200).json({
            success: true,
            message: "admin has no earnings"
          });  
        }

        const totalAmounts = {};
        result.forEach(item => {
          totalAmounts[item._id] = item.totalAmount / 100;
        });
        console.log(totalAmounts);
        const royaltyEarnings = totalAmounts['royalty-fee'] || 0;
        const nftEarnings = totalAmounts['nft-sold'] || 0;
        const totalEarnings = royaltyEarnings + nftEarnings;
        return res.status(200).json({
          success: true,
          royaltyEarnings,
          nftEarnings,
          totalEarnings            
        });
      } catch (error) {
        console.log("error (try-catch) : " + error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    });

router
  .route("/:userId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        if (req.params.userId == undefined) {
          return res.status(400).json({
            success: false,
            message: "User Id not found in request body.",
          });
        }
        if (req.params.userId == "") {
          return res.status(400).json({
            success: false,
            message: "User Id found empty in request body.",
          });
        }
        const earnings = await EarningsModel.find({
          userId: req.params.userId,
        });

        let sum = 0;
        for (let i = 0; i < earnings.length; i++) {
          sum += earnings[i].amount;
        }

        return res.status(200).json({
          success: true,
          totalEarnings: sum,
          earnings,
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
