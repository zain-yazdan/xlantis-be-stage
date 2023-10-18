var express = require("express");
var router = express.Router();

const auth = require("../../middlewares/auth");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});
const {
  checkMissingAttributes,
  checkEmptyAttributes,
} = require("../../utils/request-body");
const AnalyticsModel = require("../../models/Analytics");

router
  .route("/")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin", "super-admin"),
    async function (req, res, next) {
      try {
        const requiredAttributes = [
          "viewerId",
          "viewedAt",
          "viewDuration",
          "timesSold",
          "soldAt",
          "saleDuration",
        ];

        const missingAttribute = checkMissingAttributes(
          req.body,
          requiredAttributes
        );
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: missingAttribute + " not found in request body!",
          });
        }

        let analytics = {
          viewerId: req.body.viewerId,
          viewedAt: req.body.viewedAt,
          viewDuration: req.body.viewDuration,
          timesSold: req.body.timesSold,
          soldAt: req.body.soldAt,
          saleDuration: req.body.saleDuration,
        };
        if (req.body.nftId) {
          // const previousData = await AnalyticsModel.findOne({nftId: req.body.nftId});
          // if(previousData){
          //     return res.status(400).json({
          //         success: false,
          //         message:"NFT analytics data already exists."
          //     })
          // }
          analytics["nftId"] = req.body.nftId;
          requiredAttributes.push("nftId");
        } else if (req.body.dropId) {
          // const previousData = await AnalyticsModel.findOne({dropId: req.body.dropId});
          // if(previousData){
          //     return res.status(400).json({
          //         success: false,
          //         message:"Drop analytics data already exists."
          //     })
          // }
          analytics["dropId"] = req.body.dropId;
          requiredAttributes.push("dropId");
        } else {
          res.status(400).json({
            success: false,
            message: "Kindly provide a nftId or dropId.",
          });
        }

        const emptyAttributes = checkEmptyAttributes(
          req.body,
          requiredAttributes
        );
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: emptyAttributes + " was empty in request body!",
          });
        }

        await AnalyticsModel.create(analytics);

        return res.status(200).json({
          success: true,
          message: "Analytics created successfully.",
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
  .route("/nft/:nftId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin", "super-admin"),
    async function (req, res, next) {
      try {
        const analytics = await AnalyticsModel.find({
          nftId: req.params.nftId,
        });

        return res.status(200).json({
          success: true,
          analytics,
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
  .route("/drop/:dropId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin", "super-admin"),
    async function (req, res, next) {
      try {
        const analytics = await AnalyticsModel.find({
          dropId: req.params.dropId,
        });

        return res.status(200).json({
          success: true,
          analytics,
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
