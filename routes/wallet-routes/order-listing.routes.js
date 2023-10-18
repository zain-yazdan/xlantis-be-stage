var express = require("express");
var router = express.Router();
const { checkIsInRole } = require("../../middlewares/auth");

const {
  checkMissingAttributes,
  checkEmptyAttributes,
} = require("../../utils/request-body");
const auth = require("../../middlewares/auth");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});
const BigNumber = require("bignumber.js");

const DropModel = require("../../models/DropModel");
const NftModel = require("../../models/NFTModel");
const OrderListingModel = require("../../models/OrderListingModel");
const UserModel = require("../../models/UserModel");
const BidModel = require("../../models/BidModel");

const id = require("ipfs-http-client/src/id");
const { sellNFT, buyNFT } = require("../common-routes/order-listing.routes");

router
  .route("/buy")
  .post(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const requestBody = ["dropId", "nftId", "txHash"];
        const missingAttribute = checkMissingAttributes(req.body, requestBody);
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: missingAttribute + " not found in request body!",
          });
        }
        const emptyAttributes = checkEmptyAttributes(req.body, requestBody);
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: emptyAttributes + " was empty in request body!",
          });
        }
        if (req.body.txHash.length !== 66) {
          return res.status(400).json({
            success: false,
            message: "Invalid txHash sent in request body!",
          });
        }

        const user = await UserModel.findOne({
          walletAddress: req.user.walletAddress,
        });

        if (!user) {
          return res.status(400).json({
            success: false,
            message: "user dont exist against this walletAddress",
          });
        }

        const drop = await DropModel.findById({ _id: req.body.dropId });
        if (!drop) {
          return res.status(400).json({
            success: false,
            message: "Drop not found against drop Id",
          });
        }
        if (drop.status !== "active") {
          return res.status(400).json({
            success: false,
            message: "Drop is not active yet",
          });
        }

        const NFT = await NftModel.findById(req.body.nftId);
        if (!NFT) {
          return res.status(400).json({
            success: false,
            message: "Drop Id is not added in NFT",
          });
        }

        const marketPlace = await OrderListingModel.findOne({
          dropId: req.body.dropId,
          nftId: req.body.nftId,
        });

        if (!marketPlace) {
          return res.status(400).json({
            success: false,
            message: "Drop is not put on sale yet",
          });
        }

        const NFTreport = await NFT.updateOne({
          ownerId: user._id,
          currentMarketplaceId: marketPlace._id,
          dropId: null,
        });
        console.log({ NFTreport });

        const dropReport = await drop.updateOne({
          $inc: { totalNFTsSold: 1 },
        });
        console.log({ dropReport });

        const marketPlaceReport = await marketPlace.updateOne({
          isSold: true,
          soldAt: new Date(),
          txHash: req.body.txHash,
        });
        console.log({ marketPlaceReport });

        return res.status(200).json({
          success: true,
          nftNewOwner: NFT.ownerId,
          message: "NFT succesfully bought",
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
  .route("/nft/sale")
  .post(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await sellNFT(req, res);
    }
  );

router
  .route("/nft/buy")
  .post(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await buyNFT(req, res);
    }
  );

module.exports = router;
