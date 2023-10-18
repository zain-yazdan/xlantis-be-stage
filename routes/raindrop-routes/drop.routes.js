var express = require("express");
var assetRouter = express.Router();

const auth = require("../middlewares/auth");
const { checkIsProfileAdded } = require("../middlewares/profileMiddleware");
const { checkIsInRole } = require("../middlewares/authCheckRole");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});

const UserModel = require("../models/UserModel");
const dropModel = require("../models/DropModel");
const MarketplaceModel = require("../models/MarketplaceModel");
const NftModel = require("../models/NFTModel");
const MarketPlace = require("../models/MarketplaceModel");
const BidModel = require("../models/BidModel");
// const LazyMintModel = require("../models/LazyMintModel");
const BigNumber = require("bignumber.js");
const Web3 = require("web3");

const {
  checkMissingAttributes,
  checkEmptyAttributes,
  validatePaginationParams,
} = require("../utils/requestBody");

assetRouter
  .route("/statistics/:dropId")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const drop = await dropModel.findById(req.params.dropId);
        if (!drop) {
          return res.status(400).json({
            success: false,
            message: "Drop not found against this dropId.",
          });
        }

        let data = {
          totalNFTs: drop.NFTIds.length,
          createdAt: drop.createdAt,
        };

        if (drop.NFTIds.length != 0) {
          const distinctNFTOwners = await NftModel.find({
            _id: {
              $in: drop.NFTIds,
            },
          }).distinct("ownerId");

          const listings = await NftModel.find({
            _id: {
              $in: drop.NFTIds,
            },
          })
            .populate({
              path: "currentMarketplaceId",
              select: "-_id price",
            })
            .select("-_id currentMarketplaceId");

          const highestBids = await BidModel.find({
            nftId: {
              $in: drop.NFTIds,
            },
            isHighestBid: true,
          }).select("bidAmount -_id");

          data["uniqueOwners"] = distinctNFTOwners.length;

          let uniqueOwnership = data.uniqueOwners / drop.NFTIds.length;
          uniqueOwnership = Math.round(uniqueOwnership);
          data["uniqueOwnership"] = uniqueOwnership;

          if (listings[0].currentMarketplaceId != undefined) {
            const prices = [];
            let listingsCount = 0;
            for (let i = 0; i < listings.length; ++i) {
              if (listings[i].currentMarketplaceId != undefined) {
                prices[listingsCount] = listings[i].currentMarketplaceId.price;
                ++listingsCount;
              }
            }

            let floorPrice = Math.min(...prices);
            floorPrice = Web3.utils.toBN(floorPrice).toString();
            floorPrice = Web3.utils.fromWei(floorPrice, "ether");

            let volume = BigNumber(BigNumber.sum.apply(null, prices));
            volume = Web3.utils.toBN(volume).toString();
            volume = Web3.utils.fromWei(volume, "ether");

            data["listingsCount"] = listingsCount;
            data["volume"] = volume;
            data["floorPrice"] = floorPrice;
          }

          if (highestBids.length != 0) {
            let bestOffer = Math.max.apply(
              Math,
              highestBids.map((bids) => {
                return bids.bidAmount;
              })
            );
            bestOffer = Web3.utils.toBN(bestOffer).toString();
            bestOffer = Web3.utils.fromWei(bestOffer, "ether");
            data["bestOffer"] = bestOffer;
          }
        }

        return res.status(200).json({
          success: true,
          data,
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

assetRouter
  .route("/nfts/:dropId/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user", "admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const start = req.params.start;
        const end = req.params.end;

        const checkPagination = validatePaginationParams(start, end);
        if (checkPagination.success == false) {
          return res.status(400).json({
            success: false,
            message: checkPagination.message,
          });
        }

        const drop = await dropModel.findById(req.params.dropId);
        if (!drop) {
          return res.status(400).json({
            success: false,
            message: "drop not found",
          });
        }

        const data = await NftModel.find({
          _id: { $in: drop.NFTIds },
        })
          .populate({
            path: "collectionId",
            select: "nftContractAddress contractType",
          })
          .populate({
            path: "currentMarketplaceId",
            select: "price isSold",
          });

        console.log("nfts: ", data);
        if (data.length === 0) {
          return res.status(404).json({
            success: false,
            message: "No NFTs were found against requested drop!",
          });
        }

        const reverse = data.reverse();
        const result = reverse.slice(start, end);

        return res.status(200).json({
          success: true,
          data: result,
        });
      } catch (err) {
        console.log("error (try-catch) : " + err);
        return res.status(500).json({
          success: false,
          error: err,
        });
      }
    }
  );

assetRouter
  .route("/myDrops/:status/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const start = req.params.start;
        const end = req.params.end;

        const checkPagination = validatePaginationParams(start, end);
        if (checkPagination.success == false) {
          return res.status(400).json({
            success: false,
            message: checkPagination.message,
          });
        }

        const status = dropModel.schema.path("status").enumValues;
        console.log("status: ", status);

        if (status.indexOf(req.params.status) == -1) {
          return res.status(400).json({
            success: false,
            message: "Requested status is not present in drop schema",
          });
        }

        const user = await UserModel.findOne({
          walletAddress: req.user.walletAddress,
        });
        console.log("user : ", user);

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "user does not exists against this walletAddress",
          });
        }

        const drops = await dropModel.find({
          userId: user._id,
          status: req.params.status,
        });
        console.log("drops: ", drops);

        const dropsReversed = drops.reverse();
        const result = dropsReversed.slice(start, end);

        return res.status(200).json({
          success: true,
          dropCount: result.length,
          data: result,
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
assetRouter
  .route("/feature")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const featuredDrop = await dropModel.findOne({
          userId: req.user._id,
          isFeatured: true,
        });

        return res.status(200).json({
          success: true,
          FeaturedDrop: featuredDrop,
        });
      } catch (err) {
        console.log("error (try-catch) : " + err);
        return res.status(500).json({
          success: false,
          error: err,
        });
      }
    }
  );

assetRouter
  .route("/feature")
  .patch(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        if (req.body.dropId == undefined) {
          return res.status(400).json({
            success: false,
            message: "Drop Id not found in request body.",
          });
        }
        if (req.body.dropId == "") {
          return res.status(400).json({
            success: false,
            message: "Drop Id was empty in request body.",
          });
        }
        const drop = await dropModel.findOne({
          _id: req.body.dropId,
        });
        console.log("Drop : ", drop);

        if (!drop) {
          return res.status(400).json({
            success: false,
            message: "Drop not found against drop Id.",
          });
        }
        if (!drop.userId.equals(req.user._id)) {
          return res.status(400).json({
            success: false,
            message: "You are not the owner of the drop.",
          });
        }
        if (drop.isFeatured) {
          return res.status(400).json({
            success: false,
            message: "Drop already featured.",
          });
        }
        await dropModel.updateOne(
          {
            userId: req.user._id,
            isFeatured: true,
          },
          {
            isFeatured: false,
          }
        );
        await drop.updateOne({ isFeatured: true });

        return res.status(200).json({
          success: true,
          message: "Drop Featured successfully.",
        });
      } catch (err) {
        console.log("error (try-catch) : " + err);
        return res.status(500).json({
          success: false,
          error: err,
        });
      }
    }
  );

assetRouter
  .route("/")
  .post(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const requiredAttributes = [
          "title",
          "image",
          "description",
          "startTime",
          "endTime",
          "saleType",
          "dropType",
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

        if (req.body.startTime >= req.body.endTime) {
          return res.status(400).json({
            success: false,
            message: "Invalid start time provided, drop ends before it starts",
          });
        }

        if (req.body.startTime < Date.now()) {
          return res.status(400).json({
            success: false,
            message: "Start time of Drop can not be from past",
          });
        }
        const saleType = dropModel.schema.path("saleType").enumValues;
        console.log("saleType: ", saleType);
        if (saleType.indexOf(req.body.saleType) == -1) {
          return res.status(400).json({
            success: false,
            message:
              "request body input for saleType field in is not defined in saleType enum for Drop Schema!",
          });
        }

        const dropType = dropModel.schema.path("dropType").enumValues;
        console.log("dropType: ", dropType);
        if (dropType.indexOf(req.body.dropType) == -1) {
          return res.status(400).json({
            success: false,
            message:
              "request body input for dropType field in is not defined in dropType enum for drop schema",
          });
        }
        const user = await UserModel.findOne({
          walletAddress: req.user.walletAddress,
        });

        const drop = await dropModel.create({
          userId: user._id,
          title: req.body.title,
          description: req.body.description,
          image: req.body.image,
          startTime: req.body.startTime,
          endTime: req.body.endTime,
          saleType: req.body.saleType,
          dropType: req.body.dropType,
        });

        return res.status(200).json({
          success: true,
          dropId: drop._id,
          message: "Drop created successfully!",
        });
      } catch (err) {
        console.log("error (try-catch) : " + err);
        return res.status(500).json({
          success: false,
          error: err,
        });
      }
    }
  );

assetRouter
  .route("/:dropId")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user", "admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const requestParams = ["dropId"];
        const missingAttribute = checkMissingAttributes(
          req.params,
          requestParams
        );
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: missingAttribute + " not found in request params!",
          });
        }
        const emptyAttributes = checkEmptyAttributes(req.params, requestParams);
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: emptyAttributes + " was empty in request params!",
          });
        }
        let result = await UserModel.findOne({
          walletAddress: req.user.walletAddress,
        });
        console.log("result : ", result);

        if (!result) {
          return res.status(404).json({
            success: false,
            message: "user dont exist against this walletAddress",
          });
        }

        let dropData = await dropModel.findOne({ _id: req.params.dropId });
        if (!dropData) {
          return res.status(404).json({
            success: false,
            message: "Drop not found",
          });
        }

        return res.status(200).json({
          success: true,
          dropData: dropData,
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

assetRouter
  .route("/nft/:nftId")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user", "admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const requestParams = ["nftId"];
        const missingAttribute = checkMissingAttributes(
          req.params,
          requestParams
        );
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: missingAttribute + " not found in request params!",
          });
        }
        const emptyAttributes = checkEmptyAttributes(req.params, requestParams);
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: emptyAttributes + " was empty in request params!",
          });
        }

        const nft = await NftModel.find({ _id: req.params.nftId });
        if (!nft) {
          return res.status(404).json({
            success: false,
            message: "No NFT found against provided nftId",
          });
        }

        // const marketNft = await MarketplaceModel.find({
        // 	nftId: req.params.nftId,
        // });

        // if (!marketNft) {
        // 	return res.status(404).json({
        // 		success: false,
        // 		message: "No NFT found against provided nftId",
        // 	});
        // }
        // const obj3 = Object.assign({}, nft, marketNft);
        // console.log("Object : ", obj3);
        return res.status(200).json({
          success: true,
          data: nft,
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
assetRouter
  .route("/:dropId")
  .delete(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const requestParams = ["dropId"];
        const missingAttribute = checkMissingAttributes(
          req.params,
          requestParams
        );
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: missingAttribute + " not found in request params!",
          });
        }
        const emptyAttributes = checkEmptyAttributes(req.params, requestParams);
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: emptyAttributes + " was empty in request params!",
          });
        }
        let result = await UserModel.findOne({
          walletAddress: req.user.walletAddress,
        });
        console.log("result : ", result);

        if (!result) {
          return res.status(404).json({
            success: false,
            message: "user dont exist against this walletAddress",
          });
        }
        let dropData = await dropModel.findOne({ _id: req.params.dropId });
        if (!dropData) {
          return res.status(400).json({
            success: false,
            message: "Drop not found against drop Id",
          });
        }
        for (let i = 0; i < dropData.NFTIds.length; i++) {
          const nft = await NftModel.findOne({ _id: dropData.NFTIds[i] });
          await nft.updateOne({ dropId: null });
        }
        let marketDrop = await MarketplaceModel.findOne({
          dropId: req.params.dropId,
        });
        console.log("Market DRop : ", marketDrop);
        await marketDrop.updateOne({ dropId: null });

        await dropModel.deleteOne({ _id: req.params.dropId });
        return res.status(200).json({
          success: true,
          message: "Drop deleted successfully",
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

assetRouter
  .route("/nft/:nftId")
  .delete(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const requestParams = ["nftId"];
        const missingAttribute = checkMissingAttributes(
          req.params,
          requestParams
        );
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: missingAttribute + " not found in request params!",
          });
        }
        const emptyAttributes = checkEmptyAttributes(req.params, requestParams);
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: emptyAttributes + " was empty in request params!",
          });
        }

        const nft = await NftModel.findOne({ _id: req.params.nftId });

        if (!nft) {
          return res.status(404).json({
            success: false,
            message: "No NFT found against provided nftId",
          });
        }
        if (!nft.dropId) {
          return res.status(404).json({
            success: false,
            message: "Nft is not a part of any drop",
          });
        }
        const dropNft = await dropModel.findOne({ _id: nft.dropId });
        console.log("Drop status : ", dropNft);

        let deletesNFT;
        if (!dropNft) {
          return res.status(404).json({
            success: false,
            message: "Nft drop not found",
          });
        }

        if (dropNft.status != "draft") {
          return res.status(404).json({
            success: false,
            message: "Cannot delete Drop because it is not in the draft state ",
          });
        } else {
          await nft.updateOne({ dropId: null });

          deletesNFT = await dropModel.updateOne(
            { _id: nft.dropId },
            {
              $pullAll: {
                NFTIds: [req.params.nftId],
              },
            }
          );
        }
        return res.status(200).json({
          success: true,
          message: "NFT in drop deleted successfully",
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

assetRouter
  .route("/nft")
  .put(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const checkAttributes = ["nftId", "dropId", "price"];
        let isERC1155 = true;
        if (req.body.supply == undefined) isERC1155 = false;
        if (isERC1155) checkAttributes.push("supply");

        const missingAttribute = checkMissingAttributes(
          req.body,
          checkAttributes
        );
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: missingAttribute + " not found in request body!",
          });
        }

        const emptyAttributes = checkEmptyAttributes(req.body, checkAttributes);
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: emptyAttributes + " was empty in request body!",
          });
        }

        if (isERC1155 && req.body.supply < 1) {
          return res.status(400).json({
            success: false,
            message: "supply must be 1 or greater!",
          });
        }

        if (new BigNumber(req.body.price).isGreaterThan(0) == false) {
          return res.status(400).json({
            success: false,
            message: "price must be greater than 0!",
          });
        }

        const drop = await dropModel.findById(req.body.dropId);
        if (!drop) {
          return res.status(404).json({
            success: false,
            message: "Drop not found against provided Drop Id!",
          });
        }
        if (drop.status != "draft") {
          return res.status(404).json({
            success: false,
            message:
              "Unable to add NFT to drop, Drop is not in editable state!",
          });
        }

        const NFT = await NftModel.findById(req.body.nftId);
        if (!NFT) {
          return res.status(404).json({
            success: false,
            message: "NFT not found against provided NFT Id!",
          });
        }

        if (NFT.dropId != undefined) {
          if (NFT.dropId == req.body.dropId) {
            return res.status(400).json({
              success: false,
              message: "NFT is already assigned to requested Drop!",
            });
          } else {
            return res.status(400).json({
              success: false,
              message: "NFT is already assigned to another Drop!",
            });
          }
        }
        const marketplace = {
          dropId: req.body.dropId,
          nftId: req.body.nftId,
          collectionId: NFT.collectionId,
          price: req.body.price,
        };

        if (isERC1155) marketplace.supply = req.body.supply;

        const marketPlace = await MarketPlace.create(marketplace);

        console.log("MarketPlace: ", marketPlace);
        drop.NFTIds.push(req.body.nftId);
        drop.totalNFTs = drop.totalNFTs + 1;
        NFT.dropId = req.body.dropId;
        NFT.currentMarketplaceId = marketPlace._id;
        await NFT.save();
        await drop.save();

        return res.status(200).json({
          success: true,
          message: "NFT added to drop successfully!",
        });
      } catch (err) {
        console.log("error (try-catch) : " + err);
        return res.status(500).json({
          success: false,
          error: err,
        });
      }
    }
  );

assetRouter
  .route("/status/pending")
  .put(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const checkAttributes = ["dropId"];

        const missingAttribute = checkMissingAttributes(
          req.body,
          checkAttributes
        );
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: missingAttribute + " not found in request body!",
          });
        }

        const emptyAttributes = checkEmptyAttributes(req.body, checkAttributes);
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: emptyAttributes + " was empty in request body!",
          });
        }

        const drop = await dropModel.findById(req.body.dropId);
        if (!drop) {
          return res.status(404).json({
            success: false,
            message: "Drop not found against provided Drop Id!",
          });
        }

        if (drop.status !== "draft") {
          return res.status(400).json({
            success: false,
            message:
              "Unable to update drop status, Drop is not in editable state!",
          });
        }

        drop.status = "pending";
        await drop.save();

        return res.status(200).json({
          success: true,
          message: "Drop successfully finalized awaiting blockchain event!",
        });
      } catch (err) {
        console.log("error (try-catch) : " + err);
        return res.status(500).json({
          success: false,
          error: err,
        });
      }
    }
  );

assetRouter
  .route("/txHash")
  .put(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const checkAttributes = ["dropId", "txHash"];

        const missingAttribute = checkMissingAttributes(
          req.body,
          checkAttributes
        );
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: missingAttribute + " not found in request body!",
          });
        }

        const emptyAttributes = checkEmptyAttributes(req.body, checkAttributes);
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: emptyAttributes + " was empty in request body!",
          });
        }

        const drop = await dropModel.findById(req.body.dropId);
        if (!drop) {
          return res.status(404).json({
            success: false,
            message: "Drop not found against provided Drop Id!",
          });
        }

        if (drop.status !== "pending") {
          return res.status(400).json({
            success: false,
            message:
              "Unable to update txHash, Drop is not in appropriate state!",
          });
        }

        drop.txHash = req.body.txHash;
        await drop.save();

        return res.status(200).json({
          success: true,
          message: "Drop successfully updated, txHash added!",
        });
      } catch (err) {
        console.log("error (try-catch) : " + err);
        return res.status(500).json({
          success: false,
          error: err,
        });
      }
    }
  );

assetRouter
  .route("/:status/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user", "admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const checkAttributes = ["status", "start", "end"];

        const missingAttribute = checkEmptyAttributes(
          req.params,
          checkAttributes
        );
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: missingAttribute + " not found in request body!",
          });
        }
        const start = req.params.start;
        const end = req.params.end;

        const checkPagination = validatePaginationParams(start, end);
        if (checkPagination.success == false) {
          return res.status(400).json({
            success: false,
            message: checkPagination.message,
          });
        }

        const status = dropModel.schema.path("status").enumValues;
        console.log("status: ", status);

        if (status.indexOf(req.params.status) == -1) {
          return res.status(400).json({
            success: false,
            message: " Requested param is not present in Drop schema!",
          });
        }

        const drops = await dropModel.find({ status: req.params.status });
        console.log("drops: ", drops);
        if (drops.length == 0) {
          return res.status(404).json({
            success: false,
            message: "No drops were found against provided status!",
          });
        }

        const reverse = drops.reverse();
        const result = reverse.slice(start, end);

        return res.status(200).json({
          success: true,
          data: result,
        });
      } catch (err) {
        console.log("error (try-catch) : " + err);
        return res.status(500).json({
          success: false,
          error: err,
        });
      }
    }
  );

assetRouter
  .route("/saleType/:saleType/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user", "admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const start = req.params.start;
        const end = req.params.end;

        const checkPagination = validatePaginationParams(start, end);
        if (checkPagination.success == false) {
          return res.status(400).json({
            success: false,
            message: checkPagination.message,
          });
        }

        const saleType = dropModel.schema.path("saleType").enumValues;
        console.log("saleType: ", saleType);

        if (saleType.indexOf(req.params.saleType) == -1) {
          return res.status(400).json({
            success: false,
            message: " Requested param is not present in Drop schema!",
          });
        }

        const drops = await dropModel.find({ saleType: req.params.saleType });
        console.log("drops: ", drops);
        if (drops.length === 0) {
          return res.status(404).json({
            success: false,
            message: "No drops were found against provided saleType!",
          });
        }

        const reverse = drops.reverse();
        const result = reverse.slice(start, end);

        return res.status(200).json({
          success: true,
          data: result,
        });
      } catch (err) {
        console.log("error (try-catch) : " + err);
        return res.status(500).json({
          success: false,
          error: err,
        });
      }
    }
  );

module.exports = assetRouter;
