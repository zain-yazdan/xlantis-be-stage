var express = require("express");
var router = express.Router();
const { checkIsInRole } = require("../middlewares/authCheckRole");

const {
  checkMissingAttributes,
  checkEmptyAttributes,
} = require("../utils/requestBody");
const auth = require("../middlewares/auth");
const { checkIsProfileAdded } = require("../middlewares/profileMiddleware");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});
const BigNumber = require("bignumber.js");

// const DropModel = require("../models/DropModel");
const NftModel = require("../models/NFTModel");
const DropModel = require("../models/DropModel");
const MarketplaceModel = require("../models/MarketplaceModel");
const UserModel = require("../models/UserModel");
const CartModel = require("../models/CartModel");

router
  .route("/")
  .post(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user"),
    async function (req, res, next) {
      try {
        const requestBody = ["nftId"];
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

        const user = await UserModel.findOne({
          walletAddress: req.user.walletAddress,
        });

        // if (!user) {
        // 	return res.status(400).json({
        // 		success: false,
        // 		message: "user dont exist against this walletAddress",
        // 	});
        // }

        const NFT = await NftModel.findById(req.body.nftId);
        if (!NFT) {
          return res.status(400).json({
            success: false,
            message: "NFT not found against nft Id.",
          });
        }
        if (NFT.ownerId.equals(user._id)) {
          return res.status(400).json({
            success: false,
            message: "Owner can not add NFT cart.",
          });
        }
        if (!NFT.isOnSale) {
          return res.status(400).json({
            success: false,
            message: "This NFT is not on sale.",
          });
        }
        const marketplaceData = await MarketplaceModel.findById(
          NFT.currentMarketplaceId
        );
        if (!marketplaceData) {
          return res.status(400).json({
            success: false,
            message: "marketplace Data not found against nft",
          });
        }
        if (marketplaceData.saleType != "fixed-price") {
          return res.status(400).json({
            success: false,
            message:
              "Nft is not on fixed-price sale so It cannot be added to cart.",
          });
        }
        let addToCart = {
          userId: user._id,
          nftId: req.body.nftId,
          collectionId: NFT.collectionId,
          marketplaceId: NFT.currentMarketplaceId,
        };

        if (NFT.dropId) {
          const dropData = await DropModel.findById(NFT.dropId);
          if (!dropData) {
            return res.status(400).json({
              success: false,
              message: "drop Data not found against nft",
            });
          }
          if (dropData.saleType != "fixed-price") {
            return res.status(400).json({
              success: false,
              message:
                "Drop is not on fixed-price sale so It cannot be added to cart.",
            });
          }
          addToCart["dropId"] = NFT.dropId;
        }

        await CartModel.create(addToCart);

        return res.status(200).json({
          success: true,
          addToCart,
          message: "NFT successfully added to Cart.",
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
  .route("/buy")
  .post(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user"),
    async function (req, res, next) {
      try {
        const user = await UserModel.findOne({
          walletAddress: req.user.walletAddress,
        });

        // if (!user) {
        // 	return res.status(400).json({
        // 		success: false,
        // 		message: "user dont exist against this walletAddress",
        // 	});
        // }
        const NFTsInCart = await CartModel.find({
          userId: user._id,
        });
        // const ids = NFTsInCart.filter((objects)=>{return objects._id});
        if (NFTsInCart.length == 0) {
          return res.status(400).json({
            success: false,
            message: "NFTs not found in cart against this user.",
          });
        }
        let ids = [];
        for (let i = 0; i < NFTsInCart.length; i++) {
          ids.push(NFTsInCart[i].nftId);
        }
        console.log("IDS : ", ids);
        const NFT = await NftModel.find({
          _id: {
            $in: ids,
          },
          isOnSale: true,
        });
        // console.log("NFTS: ",NFT)
        if (NFT.length == 0) {
          return res.status(400).json({
            success: false,
            message: "NFT not found against nftIds.",
          });
        }

        const result = await NftModel.updateMany(
          {
            _id: {
              $in: ids,
            },
          },
          {
            ownerId: user._id,
            isOnSale: false,
            currentMarketplaceId: null,
          }
        );
        await MarketplaceModel.updateMany(
          {
            _id: {
              $in: ids,
            },
          },
          {
            isSold: true,
            soldAt: Date.now(),
          }
        );

        // await CartModel.create(addToCart);

        return res.status(200).json({
          success: true,
          TotalNFTsBought: result.modifiedCount,
          message: "NFT successfully Bought.",
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
  .route("/")
  .delete(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user"),
    async function (req, res, next) {
      try {
        if (req.query.nftId == undefined) {
          return res.status(400).json({
            success: false,
            message: "NFT id not found in query params.",
          });
        }

        if (req.query.nftId == "") {
          return res.status(400).json({
            success: false,
            message: "NFT id empty in query params.",
          });
        }
        const user = await UserModel.findOne({
          walletAddress: req.user.walletAddress,
        });

        // if (!user) {
        // 	return res.status(400).json({
        // 		success: false,
        // 		message: "user dont exist against this walletAddress",
        // 	});
        // }
        const NFTInCart = await CartModel.findOne({
          nftId: req.query.nftId,
        });
        if (!NFTInCart) {
          return res.status(400).json({
            success: false,
            message: "NFT not found in cart against nftId.",
          });
        }
        if (!NFTInCart.userId.equals(user._id)) {
          return res.status(400).json({
            success: false,
            message: "This User did not add this item.",
          });
        }
        await CartModel.deleteOne({ _id: NFTInCart._id });

        return res.status(200).json({
          success: true,
          message: "NFT successfully Deleted from the cart.",
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
  .route("/")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user"),
    async function (req, res, next) {
      try {
        // const requestBody = ["nftId"];
        // const missingAttribute = checkMissingAttributes(req.body, requestBody);
        // if (missingAttribute != null) {
        // 	return res.status(400).json({
        // 		success: false,
        // 		message: missingAttribute + " not found in request body!",
        // 	});
        // }
        // const emptyAttributes = checkEmptyAttributes(req.body, requestBody);
        // if (emptyAttributes != null) {
        // 	return res.status(400).json({
        // 		success: false,
        // 		message: emptyAttributes + " was empty in request body!",
        // 	});
        // }

        const user = await UserModel.findOne({
          walletAddress: req.user.walletAddress,
        });

        // if (!user) {
        // 	return res.status(400).json({
        // 		success: false,
        // 		message: "user dont exist against this walletAddress",
        // 	});
        // }

        const NFTs = await CartModel.find({ userId: user._id });

        return res.status(200).json({
          success: true,
          NFTs,
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
