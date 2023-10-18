var express = require("express");
var assetRouter = express.Router();

const auth = require("../../middlewares/auth");

const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});
const BigNumber = require("bignumber.js");
const Web3 = require("web3");

const {
  checkMissingAttributes,
  checkEmptyAttributes,
  validatePaginationParams,
  isTimeValid,
} = require("../../utils/request-body");

const {
  approvePaymentToken,
  createBid,
  acceptBid,
} = require("../utils/silent-wallet");

const UserModel = require("../../models/UserModel");
const NFTModel = require("../../models/NFTModel");
const BidModel = require("../../models/BidModel");
const OrderListingModel = require("../../models/OrderListingModel");
const NftModel = require("../../models/NFTModel");
const DropModel = require("../../models/DropModel");
const NotificationModel = require("../../models/NotificationModel");
const TradeHistoryModel = require("../../models/TradeHistory");

const { sendNotification } = require("../../utils/notification");

assetRouter
  .route("/bid")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const requiredAttributes = ["nftId", "bidAmount", "expiryTime"];

        const missingAttribute = checkMissingAttributes(
          req.body,
          requiredAttributes
        );
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: `${missingAttribute} not found in request body!`,
          });
        }

        const emptyAttributes = checkEmptyAttributes(
          req.body,
          requiredAttributes
        );
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: `${emptyAttributes} was empty in request body!`,
          });
        }

        const bidTime = new Date();
        const expiryTime = new Date(req.body.expiryTime);

        if (bidTime > expiryTime) {
          return res.status(400).json({
            success: false,
            message: "bid ends before it starts",
          });
        }
        // bidTime:  1664898852581
        // expiry:   1664897877728

        if (new BigNumber(req.body.bidAmount).isGreaterThan(0) == false) {
          return res.status(400).json({
            success: false,
            message: "bidAmount must be greater than 0!",
          });
        }

        const NFT = await NFTModel.findById(req.body.nftId)
          .populate({
            path: "collectionId",
            select: "nftContractAddress",
          })
          .populate({
            path: "dropId",
            select: "dropCloneAddress",
          });

        if (!NFT) {
          return res.status(404).json({
            success: false,
            message: "NFT not found against provided NFT Id!",
          });
        }

        if (NFT.collectionId.nftContractAddress === "") {
          return res.status(400).json({
            success: false,
            message: "collection is not finalized on blockchian yet",
          });
        }

        if (NFT.dropId === null) {
          return res.status(400).json({
            success: false,
            message: "NFT is not part of any drop",
          });
        }

        if (NFT.dropId.dropCloneAddress === "") {
          return res.status(400).json({
            success: false,
            message: "drop is not finalized on blockchian yet",
          });
        }

        const user = await UserModel.findOne({
          _id: req.user._id,
        });

        if (!user) {
          return res.status(400).json({
            success: false,
            message: "User not found.",
          });
        }

        const highestBid = await BidModel.findOne({
          nftId: req.body.nftId,
          isHighestBid: true,
        });

        let isHighestBid = true;
        if (highestBid) {
          const current_bidAmount = new BigNumber(req.body.bidAmount);
          const previous_bidAmount = new BigNumber(highestBid.bidAmount);

          if (current_bidAmount.isGreaterThan(previous_bidAmount) === true) {
            highestBid.isHighestBid = false;
            await highestBid.save();
          } else {
            isHighestBid = false;
          }
        }
        // const approval = await approvePaymentToken(user, NFT.dropId.dropCloneAddress, req.body.bidAmount)
        // if (!approval.success) return res.status(400).json(approval);

        const bid = await BidModel.create({
          userId: user._id,
          nftId: req.body.nftId,
          bidTime: bidTime,
          expiryTime: expiryTime,
          // saleType: req.body.saleType,
          bidderAddress: user.walletAddress,
          bidAmount: req.body.bidAmount,
          isHighestBid,
        });

        // const bidTx = await createBid(user, NFT , bid._id.toString(), req.body.bidAmount)
        // if (!bidTx.success) return res.status(400).json(bidTx);

        const report = await bid.updateOne({
          // bidFinalizationTxHash: bidTx.receipt.transactionHash,
          status: "active",
        });
        console.log({ report });
        return res.status(200).json({
          success: true,
          bidId: bid._id,
          message: "Bid placed successfully!",
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
  .route("/notifications/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
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
        // const user = await UserModel.findOne({
        //     walletAddress: req.user.walletAddress
        // });
        // if (!user) {
        // 	return res.status(404).json({
        // 		success: false,
        // 		message: "user not found against wallet address.",
        // 	});
        // }
        const Notifications = await NotificationModel.find({
          userId: req.user._id,
        });

        const result = Notifications.slice(start, end);

        return res.status(200).json({
          success: true,
          Notifications: result,
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
  .route("/bid/finalize")
  .put(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const requestedParamters = ["bidId", "txHash"];

        const missingAttribute = checkMissingAttributes(
          req.body,
          requestedParamters
        );
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: `${missingAttribute} not found in request body.`,
          });
        }

        const emptyAttributes = checkEmptyAttributes(
          req.body,
          requestedParamters
        );
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: `${emptyAttributes} was empty in request body.`,
          });
        }

        if (req.body.txHash.length !== 66) {
          return res.status(400).json({
            success: false,
            message: "Invalid txHash sent in request body!",
          });
        }

        const bid = await BidModel.findById(req.body.bidId);
        if (!bid) {
          return res.status(404).json({
            success: false,
            message: "No bid found against provided bidId.",
          });
        }
        console.log({ bid });

        if (bid.status !== "pending") {
          return res.status(400).json({
            success: false,
            message: "Unable to finalize, bid is already activated or expired.",
          });
        }

        const report = await bid.updateOne({
          bidFinalizationTxHash: req.body.txHash,
          status: "active",
        });
        console.log({ report });

        return res.status(200).json({
          success: true,
          message: "Bid successfully finalized",
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
  .route("/bid/tx-cost-summary")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin", "user"),
    async function (req, res, next) {
      try {
        return res.status(200).json({
          success: true,
          data: {
            transactions: 2,
            data: [
              {
                transaction: "payment token approval",
                estimatedGas: 46049,
              },
              {
                transaction: "bid on NFT",
                estimatedGas: 174607,
              },
            ],
          },
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
  .route("/bid/accept/tx-cost-summary")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin", "user"),
    async function (req, res, next) {
      try {
        return res.status(200).json({
          success: true,
          data: {
            transactions: 1,
            data: {
              transaction: "accept bid on NFT",
              estimatedGas: 202131,
            },
          },
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
  .route("/bid/highest/:nftId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const NFT = await NFTModel.findById(req.params.nftId);
        if (!NFT) {
          return res.status(404).json({
            success: false,
            message: "NFT not found against provided NFT Id!",
          });
        }

        const highestBid = await BidModel.findOne({
          nftId: req.params.nftId,
          isHighestBid: true,
        }).select("bidAmount expiryTime status");
        console.log("highestBid: ", highestBid);

        if (!highestBid) {
          return res.status(404).json({
            success: false,
            message: "No bids were found against requested NFT!",
          });
        }

        return res.status(200).json({
          success: true,
          highestBid,
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
  .route("/:nftId/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const checkAttributes = ["nftId", "start", "end"];

        const missingAttribute = checkEmptyAttributes(
          req.params,
          checkAttributes
        );
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: missingAttribute + " not found in request params!",
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

        const NFT = await NFTModel.findById(req.params.nftId);
        if (!NFT) {
          return res.status(404).json({
            success: false,
            message: "NFT not found against provided NFT Id!",
          });
        }

        const bids = await BidModel.find({ nftId: req.params.nftId });
        console.log("bids: ", bids);

        if (bids.length == 0) {
          return res.status(404).json({
            success: false,
            message: "No bids were found against requested NFT!",
          });
        }

        const reverse = bids.reverse();
        const result = reverse.slice(start, end);

        return res.status(200).json({
          success: true,
          bids: result,
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
  .route("/bids/:nftId/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
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
        const NFT = await NFTModel.findById(req.params.nftId);
        if (!NFT) {
          return res.status(404).json({
            success: false,
            message: "NFT not found against provided NFT Id!",
          });
        }
        const bids = await BidModel.find({ nftId: req.params.nftId });
        if (bids.length === 0) {
          return res.status(404).json({
            success: false,
            message: "No bid(s) found against requested NFT.",
          });
        }
        console.log({ bids });

        const reverse = bids.reverse();
        const result = reverse.slice(start, end);

        return res.status(200).json({
          success: true,
          totalBids: bids.length,
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
  .route("/bid/accept")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        if (req.body.bidId == undefined) {
          return res.status(400).json({
            success: false,
            message: `bidId not found in request body.`,
          });
        }
        if (req.body.bidId === "") {
          return res.status(400).json({
            success: false,
            message: `bidId was empty in request body.`,
          });
        }

        const bid = await BidModel.findById(req.body.bidId);
        if (!bid) {
          return res.status(404).json({
            success: false,
            message: "No bid found against provided bidId.",
          });
        }

        if (bid.isAccepted) {
          return res.status(400).json({
            success: false,
            message: "Bid is already accepted.",
          });
        }

        // const updation = { ownerId: bid.userId }

        const NFT = await NftModel.findById(bid.nftId).populate({
          path: "collectionId",
          select: "nftContractAddress",
        });

        const user = await UserModel.findOne({
          _id: req.user._id,
        });

        if (!user) {
          return res.status(400).json({
            success: false,
            message: "User not found.",
          });
        }

        // const acceptBidTx = await acceptBid(user, NFT , req.body.bidId)
        // if (!acceptBidTx.success) return res.status(400).json(acceptBidTx);

        const bidUpdation = {
          isAccepted: true,
          // bidAcceptionTxHash: acceptBidTx.receipt.transactionHash
        };

        await TradeHistoryModel.create({
          nftId: bid.nftId,
          sellerId: NFT.ownerId,
          buyerId: bid.userId,
          soldAt: Date.now(),
          saleType: "auction",
          unitPrice: bid.bidAmount,
          supply: 1
        });

        const nftReport = await NFT.updateOne({ ownerId: bid.userId });
        console.log({ nftReport });

        const bidReport = await bid.updateOne(bidUpdation);
        console.log({ bidReport });

        const marketPlace = await OrderListingModel.findOne({
          nftId: bid.nftId,
          isSold: false,
          dropId: NFT.dropId,
        });

        if (!marketPlace) {
          return res.status(400).json({
            success: false,
            message: "Drop is not put on sale yet",
          });
        }

        const marketPlaceReport = await marketPlace.updateOne({
          isSold: true,
          soldAt: new Date(),
          // txHash: acceptBidTx.receipt.transactionHash,
        });

        const notification = await NotificationModel.create({
          userId: bid.userId,
          message: "Bid on Drop NFT accepted by the owner.",
        });
        sendNotification(notification);

        return res.status(200).json({
          success: true,
          message: "Bid successfully accepted",
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
  .route("/nft/auction")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const requestBody = ["nftId", "price", "startTime", "endTime"];
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

        if (parseInt(req.body.price) <= 0) {
          return res.status(400).json({
            success: false,
            message: "Start bid must be greater than 0.",
          });
        }
        const checkPagination = isTimeValid(
          req.body.startTime,
          req.body.endTime
        );
        if (checkPagination.success == false) {
          return res.status(400).json({
            success: false,
            message: checkPagination.message,
          });
        }
        // const startTime = new Date(req.body.startTime);
        // const endTime = new Date(req.body.endTime);
        // if (startTime.getTime() >= endTime.getTime()) {
        // 	return res.status(400).json({
        // 		success: false,
        // 		message: "Auction start time must be less than the end time.",
        // 	});
        // }
        // if (startTime.getTime() < Date.now()) {
        // 	return res.status(400).json({
        // 		success: false,
        // 		message: "Start time of auction can not be from past.",
        // 	});
        // }
        // const user = await UserModel.findOne({
        // 	email: req.user.email,
        // });

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
        if (!NFT.ownerId.equals(req.user._id)) {
          return res.status(400).json({
            success: false,
            message: "Only Owner can put NFT on auction.",
          });
        }
        if (NFT.isOnSale) {
          return res.status(400).json({
            success: false,
            message: "This NFT is already on sale.",
          });
        }
        const marketplaceData = await OrderListingModel.create({
          userId: req.user._id,
          nftId: req.body.nftId,
          collectionId: NFT.collectionId,
          price: req.body.price,
          startTime: req.body.startTime,
          endTime: req.body.endTime,
          saleType: "auction",
        });
        const NFTreport = await NFT.updateOne({
          isOnSale: true,
          currentOrderListingId: marketplaceData._id,
        });
        console.log({ NFTreport });

        return res.status(200).json({
          success: true,
          message: "NFT successfully put on auction",
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

assetRouter
  .route("/nft/bid")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const requestBody = ["nftId", "bidAmount", "expiryTime"];
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
        const expiryTime = new Date(req.body.expiryTime);
        // const user = await UserModel.findOne({
        // 	email: req.user.email,
        // });

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
        const marketplaceData = await OrderListingModel.findById(
          NFT.currentOrderListingId
        );
        if (!marketplaceData) {
          return res.status(400).json({
            success: false,
            message: "Nft not found in marketplace.",
          });
        }
        if (NFT.isOnSale != true) {
          return res.status(400).json({
            success: false,
            message: "NFT is not on sale.",
          });
        }
        if (req.user._id.equals(NFT.ownerId)) {
          return res.status(400).json({
            success: false,
            message: "Owner cannot bid on his own NFT.",
          });
        }
        if (marketplaceData.saleType != "auction") {
          return res.status(400).json({
            success: false,
            message: "Nft is not on timed auction.",
          });
        }
        if (marketplaceData.startTime.getTime() > Date.now()) {
          return res.status(400).json({
            success: false,
            message: "Auction is not started yet.",
          });
        }
        if (marketplaceData.endTime.getTime() < Date.now()) {
          return res.status(400).json({
            success: false,
            message: "Auction is end now.",
          });
        }

        if (parseInt(req.body.bidAmount) < parseInt(marketplaceData.price)) {
          return res.status(400).json({
            success: false,
            message: "Bid must be higher than the start bid.",
          });
        }

        // if (marketplaceData.bid > 0) {
        // 	if (req.body.bid <= marketplaceData.bid) {
        // 		return res.status(400).json({
        // 			success: false,
        // 			message: "Bid must be higher then the previous bid.",
        // 		});
        // 	}
        // }
        // const report = await marketplaceData.updateOne({
        // 	bid: req.body.bid,
        // 	bidder: user._id,
        // });
        // console.log({ report });
        if (expiryTime.getTime() < Date.now()) {
          return res.status(400).json({
            success: false,
            message: "Bid expiryTime should be greater than start time.",
          });
        }
        const highestBid = await BidModel.findOne({
          nftId: req.body.nftId,
          isHighestBid: true,
        });
        let isHighestBid = true;
        if (highestBid) {
          const current_bidAmount = new BigNumber(req.body.bidAmount);
          const previous_bidAmount = new BigNumber(highestBid.bidAmount);

          if (current_bidAmount.isGreaterThan(previous_bidAmount) === true) {
            highestBid.isHighestBid = false;
            await highestBid.save();
          } else {
            isHighestBid = false;
          }
        }
        const bid = await BidModel.create({
          userId: req.user._id,
          nftId: req.body.nftId,
          bidTime: Date.now(),
          expiryTime: expiryTime,
          // saleType: req.body.saleType,
          bidderAddress: req.user._id,
          bidAmount: req.body.bidAmount,
          isHighestBid,
        });
        return res.status(200).json({
          success: true,
          bidId: bid._id,
          message: "Bid added successfully.",
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
  .route("/nft/acceptBid")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const requestBody = ["bidId" /*,"txHash"*/];
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

        // const user = await UserModel.findOne({
        // 	walletAddress: req.user.walletAddress,
        // });

        // if (!user) {
        // 	return res.status(400).json({
        // 		success: false,
        // 		message: "user dont exist against this walletAddress",
        // 	});
        // }
        const bid = await BidModel.findById(req.body.bidId);
        if (!bid) {
          return res.status(400).json({
            success: false,
            message: "No bid found against provided bidId.",
          });
        }
        if (bid.isAccepted) {
          return res.status(400).json({
            success: false,
            message: "Bid is already accepted.",
          });
        }
        const NFT = await NftModel.findById(bid.nftId);
        if (!NFT) {
          return res.status(400).json({
            success: false,
            message: "NFT not found against nft Id.",
          });
        }
        const marketplaceData = await OrderListingModel.findById(
          NFT.currentOrderListingId
        );
        if (!marketplaceData) {
          return res.status(400).json({
            success: false,
            message: "Nft not found in marketplace.",
          });
        }
        if (NFT.isOnSale != true) {
          return res.status(400).json({
            success: false,
            message: "NFT is not on sale.",
          });
        }
        if (marketplaceData.saleType != "auction") {
          return res.status(400).json({
            success: false,
            message: "Nft is not on timed auction.",
          });
        }
        if (marketplaceData.startTime.getTime() > Date.now()) {
          return res.status(400).json({
            success: false,
            message: "Auction is not started yet.",
          });
        }
        if (marketplaceData.endTime.getTime() >= Date.now()) {
          return res.status(400).json({
            success: false,
            message: "Auction is not end.",
          });
        }
        if (!req.user._id.equals(NFT.ownerId)) {
          return res.status(400).json({
            success: false,
            message: "Only Owner can accept the bid on his NFT.",
          });
        }
        // if (marketplaceData.bidder !== null) {
        // 	if (!user._id.equals(marketplaceData.bidder)) {
        // 		return res.status(400).json({
        // 			success: false,
        // 			message: "Only the person with highest bid can claim NFT.",
        // 		});
        // 	}
        // } else {
        // 	if (!user._id.equals(NFT.ownerId)) {
        // 		return res.status(400).json({
        // 			success: false,
        // 			message: "Only owner can claim NFT.",
        // 		});
        // 	}
        // }if (NFT.mintingType != 'lazy-mint') {

        const bidUpdation = { isAccepted: true };

        //Checking LAzyMint
        // if (NFT.mintingType != "lazy-mint") {
        // 	if (req.body.txHash == undefined) {
        // 		return res.status(400).json({
        // 			success: false,
        // 			message: `txHash not found in request body`,
        // 		});
        // 	}

        // 	if (req.body.txHash === "") {
        // 		return res.status(400).json({
        // 			success: false,
        // 			message: `txHash was empty in request body`,
        // 		});
        // 	}

        // 	if (req.body.txHash.length !== 66) {
        // 		return res.status(400).json({
        // 			success: false,
        // 			message: "Invalid txHash sent in request body!",
        // 		});
        // 	}

        // 	bidUpdation["bidAcceptionTxHash"] = req.body.txHash;
        // }
        const bidReport = await bid.updateOne(bidUpdation);
        console.log({ bidReport });

        await TradeHistoryModel.create({
          nftId: bid.nftId,
          sellerId: NFT.ownerId,
          buyerId: bid.userId,
          soldAt: Date.now(),
          saleType: "auction",
          unitPrice: bid.bidAmount,
          supply: 1
        });

        const NFTreport = await NFT.updateOne({
          ownerId: bid.userId,
          isOnSale: false,
          currentOrderListingId: null,
        });
        console.log(NFTreport);

        const report = await marketplaceData.updateOne({
          isSold: true,
          soldAt: Date.now(),
          // txHash: req.body.txHash,
        });
        console.log({ report });

        const notification = await NotificationModel.create({
          userId: bid.userId,
          message: "Bid on Single NFT accepted by the owner.",
        });
        sendNotification(notification);

        return res.status(200).json({
          success: true,
          nftNewOwner: NFT.ownerId,
          message: "Bid accepted successfully.",
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

module.exports = assetRouter;
