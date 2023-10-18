var express = require("express");
var assetRouter = express.Router();
const stripe = require("stripe")(process.env.STRIPE_API_KEY);

const auth = require("../../middlewares/auth");

const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});

const UserModel = require("../../models/UserModel");
// const UserModelV2 = require("../models/v2-wallet-login/UserModel");
const dropModel = require("../../models/DropModel");
const OrderListingModel = require("../../models/OrderListingModel");
const NftModel = require("../../models/NFTModel");
const NftOwnerModel = require("../../models/NFTOwnersData");
const CollectionModel = require("../../models/CollectionModel");

const BidModel = require("../../models/BidModel");
// const LazyMintModel = require("../models/LazyMintModel");
const BigNumber = require("bignumber.js");
const Web3 = require("web3");
const web3 = new Web3();
web3.setProvider(process.env.WEB_SOCKET);
const ABIs = require("../../blockchain/abi");
const axios = require("axios");
const { convertMaticInUsd } = require("../../actions/crypto-convert");
const { getMarketplace } = require("../utils/routes-utils/marketplace")

const { getWalletBalance } = require("../../blockchain/web3-utils");

const {
  estimateCollectionsCreation,
  estimateMints,
  estimateApprovals,
  finalizeDropTxs,
} = require("../utils/silent-wallet");
const {
  checkMissingAttributes,
  checkEmptyAttributes,
  validatePaginationParams,
  isTimeValid,
} = require("../../utils/request-body");
const { getStripeAccountLink }  = require ('../xmanna-sso-routes/stripe.routes');
const collectionModel = require("../../models/CollectionModel");
const MarketplaceModel = require("../../models/MarketplaceModel");
const CategoryModel = require("../../models/CategoryModel");

assetRouter
  .route("/category-drops/:categoryId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const start = req.query.start;
        const end = req.query.end;
  
        const checkPagination = validatePaginationParams(start, end);
        if (checkPagination.success == false) {
          return res.status(400).json({
            success: false,
            message: checkPagination.message,
          });
        }
  
        const category = await CategoryModel.findById(req.params.categoryId)
        if (!category) {
          return res.status(404).json({
            success: false,
            message: "category not found",
          });
        }
    
        const marketplace = await getMarketplace(req.query.marketplaceId)
        if (!marketplace.success) {
          return res.status(400).json(marketplace)
        }
    
        const results = await dropModel.find({
          categoryId: req.params.categoryId,
          marketplaceId: req.query.marketplaceId
        })

        const reverse = results.reverse();
        const result = reverse.slice(start, end);
          
        return res.status(200).json({
          success: true,
          data: result
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

assetRouter.route("/saleType/:saleType").get(
  // auth.verifyToken,
  // verifyUser,
  // auth.checkIsInRole("user", "admin"),
  async function (req, res, next) {
    try {
      const start = req.query.start;
      const end = req.query.end;

      const checkPagination = validatePaginationParams(start, end);
      if (checkPagination.success == false) {
        return res.status(400).json({
          success: false,
          message: checkPagination.message,
        });
      }

      const requiredAttributes = ["status", "marketplaceId"];

        const missingAttribute = checkMissingAttributes(
          req.query,
          requiredAttributes
        );
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: missingAttribute + " not found in request body!",
          });
        }

        const emptyAttributes = checkEmptyAttributes(
          req.query,
          requiredAttributes
        );
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: emptyAttributes + " was empty in request body!",
          });
        }

      
      const status = dropModel.schema.path("status").enumValues;
      console.log("status: ", status);
      if (status.indexOf(req.query.status) == -1) {
        return res.status(400).json({
          success: false,
          message: " Requested status is not present in Drop schema!",
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

      const marketplace = await getMarketplace(req.query.marketplaceId)
      if (!marketplace.success) {
        return res.status(400).json(marketplace)
      }

      const drops = await dropModel.find({
        saleType: req.params.saleType,
        marketplaceId: req.query.marketplaceId,
        status: req.query.status
      }).populate ("categoryId", "name");
      console.log("drops: ", drops);
      if (drops.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
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
  .route("/finalize")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin"),
    async function (req, res, next) {
      try {
        if (!req.body.dropId) {
          return res.status(400).json({
            success: false,
            message: "Drop Id not found in request body",
          });
        }

        if (req.body.dropId == "") {
          return res.status(400).json({
            success: false,
            message: "Drop Id found empty in request body",
          });
        }

        const drop = await dropModel.findById(req.body.dropId);
        if (!drop) {
          return res.status(400).json({
            success: false,
            message: "Drop not found against this dropId.",
          });
        }
        if (drop.isCreatedOnBlockchain) {
          return res.status(400).json({
            success: false,
            message: "Drop is already finalized",
          });
        }
        if (drop.NFTIds.length == 0) {
          return res.status(400).json({
            success: false,
            message: "Drop has no NFTs",
          });
        }

        finalizeDropTxs(req, drop);

        return res.status(200).json({
          success: true,
          message: "transactions are being processed...",
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
  .route("/publish")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin"),
    async function (req, res, next) {
      try {
        if (!req.body.dropId) {
          return res.status(400).json({
            success: false,
            message: "Drop Id not found in request body",
          });
        }

        if (req.body.dropId == "") {
          return res.status(400).json({
            success: false,
            message: "Drop Id found empty in request body",
          });
        }

        const drop = await dropModel.findById(req.body.dropId);
        if (!drop) {
          return res.status(400).json({
            success: false,
            message: "Drop not found against this dropId.",
          });
        }
        if (drop.NFTIds.length == 0) {
          return res.status(400).json({
            success: false,
            message: "Drop has no NFTs",
          });
        }

        finalizeDropTxs(req, drop);

        return res.status(200).json({
          success: true,
          message: "transactions are being processed...",
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
  .route("/:dropId/tx-cost-summary")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin", "user"),
    async function (req, res, next) {
      try {
        const drop = await dropModel.findById(req.params.dropId);
        if (!drop) {
          return res.status(400).json({
            success: false,
            message: "Drop not found against this dropId.",
          });
        }
        if (drop.NFTIds.length == 0) {
          return res.status(200).json({
            success: true,
            message: "Drop has no NFTs",
          });
        }

        const NFTs = await NftModel.find({
          _id: {
            $in: drop.NFTIds,
          },
          isMinted: false,
        });

        let NFTsTxSummary = {
          NFTCount: drop.NFTIds.length,
          txsCount: 1,
        };

        const collectionIds = [];
        for (let i = 0; i < NFTs.length; i++) {
          if (collectionIds.indexOf(NFTs[i].collectionId.toString()) == -1) {
            collectionIds.push(NFTs[i].collectionId.toString());
          }
        }
        const collectionsToDeploy = await collectionModel
          .find({
            _id: {
              $in: collectionIds,
            },
            isDeployed: false,
          })
          .select("_id isDeployed");

        let collectionTxSummary = {
          collectionCount: collectionIds.length,
          txsCount: collectionsToDeploy.length,
        };

        const approvals = await collectionModel.find({
          _id: {
            $in: collectionIds,
          },
          isSuperAdminApproved: false,
        });

        let approvalSummary = {
          superAdminApprovalPending: approvals.length,
          txsCount: approvals.length,
        };

        // const toApproveAuctions = await collectionModel.find({
        // 	_id: {
        // 		$in: collectionIds
        // 	},
        // 	isAuctionDropVerified: false,
        // }).select('_id nftContractAddress');

        // const toApproveFixedPrices = await collectionModel.find({
        // 	_id: {
        // 		$in: collectionIds
        // 	},
        // 	isFixedPriceDropVerified: false,
        // }).select('_id nftContractAddress');

        // let approvaTxlSummary = {
        // 	auctionApprovals: toApproveAuctions.length,
        // 	fixedPriceApprovals: toApproveFixedPrices.length,
        // 	txsCount: toApproveAuctions.length+toApproveFixedPrices.length
        // }

        // let dropTxSummary = {
        // 	txCount: 1
        // }
        return res.status(200).json({
          success: true,
          data: {
            collectionTxSummary,
            NFTsTxSummary,
            // approvaTxlSummary,
            approvalSummary,
            // dropTxSummary
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
const dropTransactions = async (drop) => {
  const NFTs = await NftModel.find({
    _id: {
      $in: drop.NFTIds,
    },
    isMinted: false,
  }).select("_id tokenSupply totalSupply nftURI nftId collectionId");
  // console.log("NFTs: ", NFTs);
  let NFTsTxSummary = {
    NFTCount: drop.NFTIds.length,
    txsCount: NFTs.length,
    NFTsToDeploy: NFTs,
  };

  let approvals = await NftModel.find({
    _id: {
      $in: drop.NFTIds,
    },
    superAdminApproval: false,
  });

  approvals = approvals.map((approvals) => approvals._id);

  let approvalSummary = {
    NFTCount: drop.NFTIds.length,
    txsCount: approvals.length,
    approvals,
  };

  const collectionIds = [];
  for (let i = 0; i < NFTs.length; i++) {
    if (collectionIds.indexOf(NFTs[i].collectionId.toString()) == -1) {
      collectionIds.push(NFTs[i].collectionId.toString());
    }
  }
  let collectionsToDeploy = await collectionModel
    .find({
      _id: {
        $in: collectionIds,
      },
      isDeployed: false,
    })
    .select("_id royaltyFee");

  let collectionTxSummary = {
    collectionCount: collectionIds.length,
    txsCount: collectionsToDeploy.length,
    collectionsToDeploy,
  };

  return {
    collectionTxSummary,
    NFTsTxSummary,
    approvalSummary,
  };
};

assetRouter
  .route("/validate-admin-balance/:dropId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin", "user"),
    async function (req, res, next) {
      try {
        const drop = await dropModel.findById(req.params.dropId);
        if (!drop) {
          return res.status(400).json({
            success: false,
            message: "Drop not found against this dropId.",
          });
        }
        if (drop.NFTIds.length == 0) {
          return res.status(200).json({
            success: true,
            message: "Drop has no NFTs",
          });
        }

        console.log('getting user account from polygon-api...');
        const walletBalance  = await getWalletBalance(req.user.walletAddress);

        const txSummary = await dropTransactions(drop);
        const superAdmin = await UserModel.findOne({
          role: "super-admin",
          walletAddress: process.env.SUPER_ADMIN_WALLET_ADDRESS,
          email: process.env.SUPER_ADMIN_EMAIL,
        });
    
        const collectionIds = txSummary.collectionTxSummary.collectionsToDeploy;
        let collectionEstimateInWei = await estimateCollectionsCreation(
          superAdmin,
          txSummary.collectionTxSummary.collectionsToDeploy
        );
        if (collectionEstimateInWei.success == false) {
          console.log("collectionEstimate: ", collectionEstimateInWei);
          throw "Collection estimation failed";
        }
        const mint_txs = [];
        for (let i = 0; i < collectionIds.length; i++) {
          let tx = {
            id: collectionIds[i],
            nftIds: [],
            contractAddress: "",
          };
          const nfts = await NftModel.find({
            _id: {
              $in: drop.NFTIds,
            },
            collectionId: collectionIds[i],
            isMinted: false,
          });
          if (nfts.length != 0) {
            tx.nftIds = nfts;
            tx.contractAddress = superAdmin.estimationCloneAddress;
            mint_txs.push(tx);
          }
        }

        let mintsEstimateInWei = await estimateMints(
          superAdmin,
          mint_txs
        );
        if (mintsEstimateInWei.success == false) {
          console.log("mintsEstimate: ", mintsEstimateInWei);
          throw "Mint estimation failed";
        }
        let approvalEstimateInWei = await estimateApprovals(
          superAdmin
        );
        if (approvalEstimateInWei.success == false) {
          console.log("approvalEstimate: ", approvalEstimateInWei);
          throw "Approval estimation failed";
        }
        const collectionEstimateInMatic = Web3.utils.fromWei(
          collectionEstimateInWei.toString(),
          "ether"
        );
        const collectionEstimateInDollars = await convertMaticInUsd(
          collectionEstimateInMatic
        );

        const mintsEstimateInMatic = Web3.utils.fromWei(
          mintsEstimateInWei.toString(),
          "ether"
        );
        const mintsEstimateInDollars = await convertMaticInUsd(mintsEstimateInMatic);

        approvalEstimateInWei = (
          approvalEstimateInWei * mint_txs.length
        ).toString();
        const approvalEstimateInMatic = Web3.utils.fromWei(
          approvalEstimateInWei,
          "ether"
        );
        const approvalEstimateInDollars = await convertMaticInUsd(
          approvalEstimateInMatic
        );

        const dropPublishEstimateInWei =
          collectionEstimateInWei +
          mintsEstimateInWei +
          approvalEstimateInWei * mint_txs.length;
        const dropPublishEstimateInDollars =
          collectionEstimateInDollars +
          mintsEstimateInDollars +
          approvalEstimateInDollars * mint_txs.length;
        let isTopupRequired = false;

        // const balanceInWei = xmannaUser.fiatBalance.usd.balance;

        // const balanceInMatic = Web3.utils.fromWei(balanceInWei, "ether");
        // const balanceInDollars = await convertMaticInUsd(balanceInMatic);

        // const balanceInWei = walletBalance.inWei;

        // const balanceInMatic = Web3.utils.fromWei(balanceInWei, "ether");
        const balanceInDollars = await convertMaticInUsd( walletBalance.inMatic  );
        if (dropPublishEstimateInWei > walletBalance.inWei) isTopupRequired = true;

        return res.status(200).json({
          success: true,
          estimates: {
            collection: collectionEstimateInDollars,
            nftMint: mintsEstimateInDollars,
            superAdminApproval: approvalEstimateInDollars,
            totalCostInWei: dropPublishEstimateInWei,
            totalCostInDollars: dropPublishEstimateInDollars,
          },
          balance: {
            wei: walletBalance.inWei,
            matic: walletBalance.inMatic,
            dollar: balanceInDollars,
          },
          isTopupRequired,
        });
      } catch (error) {
        console.log("errors (try-catch) : " + error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    }
  );

// endpoint made for new xlantis ui
assetRouter
  .route("/featured")
  .get(
    async function (req, res, next) {
      try {
        if (req.query.saleType == undefined) {
          return res.status(400).json({
            success: false,
            message: 'sale-type parameter not found'
          })
        }
        if (req.query.saleType == '') {
          return res.status(400).json({
            success: false,
            message: 'sale-type parameter is empty'
          })
        }
        
        const saleType = dropModel.schema.path("saleType").enumValues;
        if (saleType.indexOf(req.query.saleType) == -1) {
          return res.status(400).json({
            success: false,
            message: " invalid enum value for sale-type",
          });
        }
  
        const start = req.query.start;
        const end = req.query.end;

        const pagination = validatePaginationParams(start, end);
        if (pagination.success == false) {
          return res.status(400).json({
            success: false,
            message: pagination.message,
          });
        }

        const drops = await dropModel.find({
          status: ['pending', 'active', 'closed'],
          saleType: req.query.saleType
        })
        .populate("marketplaceId", "domain companyName marketplaceImage logoImage")
        .populate("categoryId", "name")

        const reverse = drops.reverse();
        const result = reverse.slice(start, end);
  
        return res.status(200).json({
          success: true,
          data: result
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
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {

        const marketplace = await getMarketplace(req.query.marketplaceId)
        if (!marketplace.success) {
          return res.status(400).json(marketplace)
        }

        const featuredDrop = await dropModel.findOne({
          userId: req.user._id,
          isFeatured: true,
          marketplaceId: req.query.marketplaceId
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
    auth.checkIsInRole("user", "admin"),
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
  .route("/statistics/:dropId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
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
          const distinctNFTOwners = await NftOwnerModel.find({
            nftId: {
              $in: drop.NFTIds,
            },
          }).distinct("ownerId");

          const listings = await NftModel.find({
            _id: {
              $in: drop.NFTIds,
            },
          })
            .populate({
              path: "currentOrderListingId",
              select: "-_id price",
            })
            .select("-_id currentOrderListingId");

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

          if (listings[0].currentOrderListingId != undefined) {
            const prices = [];
            let listingsCount = 0;
            for (let i = 0; i < listings.length; ++i) {
              if (listings[i].currentOrderListingId != undefined) {
                prices[listingsCount] = listings[i].currentOrderListingId.price;
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
          data: {},
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

assetRouter.route("/nfts/:dropId/:start/:end").get(
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

      let nfts = await NftModel.find({
        _id: { $in: drop.NFTIds },
      })
        .populate({
          path: "collectionId",
          select: "nftContractAddress contractType",
        })
        .populate({
          path: "currentOrderListingId",
          select: "price isSold supply totalSupplyOnSale supplySold",
        })

      if (nfts.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No NFTs were found against requested drop!",
        });
      }

      const marketplace = await MarketplaceModel.findById(nfts[0].marketplaceId);
      const companyInfo = {
        companyName: marketplace.companyName,
        username: marketplace.domain
      } 
      const sortBy = req.query.sortingOrder;
      const minPrice = parseFloat(req.query.minPrice);
      const maxPrice = parseFloat(req.query.maxPrice);
      if (sortBy && minPrice || sortBy && maxPrice) {
        return res.status(400).json({
          success: false,
          message: 'Two filter types can not be used at the same time'
        })
      }
  
      if (sortBy == "ascending") {
        nfts.sort((a, b) => parseFloat(a.currentOrderListingId.price) - parseFloat(b.currentOrderListingId.price));
      } else if (sortBy == "descending") {
        nfts.sort((a, b) => parseFloat(b.currentOrderListingId.price) - parseFloat(a.currentOrderListingId.price));
      } 

      if (!isNaN(minPrice)) {
        nfts = nfts.filter((item) => parseFloat(item.currentOrderListingId.price) >= minPrice);
      }
  
      if (!isNaN(maxPrice)) {
        nfts = nfts.filter((item) => parseFloat(item.currentOrderListingId.price) <= maxPrice);
      }

      nfts = nfts.slice(start, end);
      return res.status(200).json({
        success: true,
        data: {
          companyInfo,
          nfts,
        },
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
  .route("/my-drops/:status/:start/:end")
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

        const statusEnum = dropModel.schema.path("status").enumValues;
        const status = req.params.status;
        console.log("status: ", statusEnum);
        if (statusEnum.indexOf(status) == -1) {
          return res.status(400).json({
            success: false,
            message: "Requested status is not available",
          });
        }

        const marketplace = await getMarketplace(req.query.marketplaceId)
        if (!marketplace.success) {
          return res.status(400).json(marketplace)
        }

        let data = [];
        const timestamp = Date.now();
        console.log('timestamp: ', timestamp);
        if (status == "draft") {
          data = await dropModel.find({
            userId: req.user._id,
            isCreatedOnBlockchain: false,
            marketplaceId: req.query.marketplaceId
          }).populate({
            path: "categoryId",
            select: "name",
          });  
        } else if (status == "pending") {
          data = await dropModel.find({
            userId: req.user._id,
            isCreatedOnBlockchain: true,
            startTime: { $gt: timestamp },
            marketplaceId: req.query.marketplaceId
          }).populate({
            path: "categoryId",
            select: "name",
          });  
        } else if (status == "active") {
          data = await dropModel.find({
            userId: req.user._id,
            isCreatedOnBlockchain: true,
            startTime: { $lte: timestamp },
            endTime: { $gte: timestamp },
            marketplaceId: req.query.marketplaceId
          }).populate({
            path: "categoryId",
            select: "name",
          });  
        } else if ( status == "closed") {
          data = await dropModel.find({
            userId: req.user._id,
            isCreatedOnBlockchain: true,
            endTime: { $lt: timestamp },
            marketplaceId: req.query.marketplaceId
          }).populate({
            path: "categoryId",
            select: "name",
          });;  
        }
        
        const dropsReversed = data.reverse();
        const result = dropsReversed.slice(start, end);

        return res.status(200).json({
          success: true,
          status,
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
  .route("/")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin"),
    async function (req, res, next) {
      try {
        const requiredAttributes = [
          "title",
          "image",
          "description",
          "categoryId",
          "bannerURL",
          "saleType",
          "dropType",
          "marketplaceId",
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
        if (!req.user.stripeAccountId) {
          return res.status(400).json({
            success: false,
            message: 'stripe account not created',
          });
        }

        const account = await stripe.accounts.retrieve(req.user.stripeAccountId);
        const { details_submitted } = account;        
        if (!details_submitted) {
          return res.status(400).json({
            success: false,
            message: 'stripe onboarding is incomplete',
          });
        }

        const category = await CategoryModel.findById(req.body.categoryId)
        if (!category) {
          return res.status(404).json({
            success: false,
            message: "category not found",
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
        
        const drop = await dropModel.create({
          userId: req.user._id,
          title: req.body.title,
          description: req.body.description,
          image: req.body.image,
          categoryId: req.body.categoryId,
          bannerURL: req.body.bannerURL,
          saleType: req.body.saleType,
          dropType: req.body.dropType,
          marketplaceId: req.body.marketplaceId
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
  )
  .get(
    async function (req, res, next) {
      try {
        const start = req.query.start;
        const end = req.query.end;

        const pagination = validatePaginationParams(start, end);
        if (pagination.success == false) {
          return res.status(400).json({
            success: false,
            message: pagination.message,
          });
        }

        const parameters = ['marketplaceId', 'saleType', 'categoryId', 'status'];
        const filter = { status: ['pending', 'active', 'closed'] }
        const errors = [];

        // To check validity of query params and to build a filter
        for (const parameter of parameters) {
          if (req.query.hasOwnProperty(parameter)) {
            // add query params to filter
            filter[parameter] = req.query[parameter];

            // for enums
            if (parameter == 'saleType' || parameter == 'status') {
              const enums = dropModel.schema.path(parameter).enumValues;
              // check if query params is an array or not and set loopLimit accordingly
              const isArray = Array.isArray(filter[parameter]);
              let loopLimit = 1;
              if (isArray) loopLimit = filter[parameter].length;

              // get parameters and validate against enums
              for (let i = 0; i < loopLimit; i++) {
                let element = filter[parameter][i];                  
                if (!isArray) element = filter[parameter];
                
                if (enums.indexOf(element) == -1) errors.push(parameter);                  
              }
            } else { // for object ids
              let Model;
              if (parameter == 'marketplaceId') Model = MarketplaceModel;
              if (parameter == 'categoryId') Model = CategoryModel;
              const documents = await Model.find({
                _id: {
                  $in: req.query[parameter],
                },
              });

              let expectedDocuments = 1;
              const isArray = Array.isArray(filter[parameter]);
              if (isArray) expectedDocuments = filter[parameter].length;
              if (documents.length != expectedDocuments) errors.push(parameter);
            }
          }
        }

        if (errors.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid value(s) passed for ${errors.join(', ')}`,
          });
        }
        console.log('filter: ', filter)
        const drops = await dropModel.find(filter)
        .populate("marketplaceId", "companyName logoImage")
        .populate ("categoryId", "name");

        const reverse = drops.reverse();
        const result = reverse.slice(start, end);

        return res.status(200).json({
          success: true,
          data: result
        });
      } catch (err) {
        console.log("error (try-catch) : " + err.message);
        return res.status(500).json({
          success: false,
          error: err.message,
        });
      }
    }
  )

assetRouter
  .route("/start-time")
  .patch(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const requiredAttributes = ["dropId", "startTime", "endTime"];

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

        const checkPagination = isTimeValid(
          req.body.startTime,
          req.body.endTime
        );
        if (checkPagination.success == false) {
          return res.status(400).json({
            success: false,
            message: "Invalid start time provided, drop ends before it starts",
            message: checkPagination.message,
          });
        }

        // if (req.body.startTime >= req.body.endTime) {
        // 	return res.status(400).json({
        // 		success: false,
        // 		message: "Invalid start time provided, drop ends before it starts",
        // 	});
        // }

        // if (req.body.startTime < Date.now()) {
        // 	return res.status(400).json({
        // 		success: false,
        // 		message: "Start time of Drop can not be from past",
        // 	});
        // }

        const drop = await dropModel.findById(req.body.dropId);
        if (!drop) {
          return res.status(400).json({
            success: false,
            message: "Drop not found against Id.",
          });
        }
        await drop.updateOne({
          startTime: req.body.startTime,
          endTime: req.body.endTime,
        });

        return res.status(200).json({
          success: true,
          message: "Drop start and end time updated successfully.",
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
        // let result = await UserModel.findOne({
        // 	email: req.user.email,
        // });
        // console.log("result : ", result);

        // if (!result) {
        // 	return res.status(404).json({
        // 		success: false,
        // 		message: "user dont exist against this walletAddress",
        // 	});
        // }

        let dropData = await dropModel
          .findOne({ _id: req.params.dropId })
          .populate("marketplaceId", "companyName domain")
          .populate("categoryId", "name");

        if (!dropData) {
          return res.status(404).json({
            success: false,
            message: "Drop not found",
          });
        }

        // code to rename domain to username 
        let obj = JSON.stringify(dropData);
        obj = JSON.parse(obj);
        obj.marketplaceId.username = obj.marketplaceId.domain;
        delete obj.marketplaceId.domain;

        return res.status(200).json({
          success: true,
          dropData: obj,
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

assetRouter.route("/nft/:nftId").get(
  // auth.verifyToken,
  // verifyUser,
  // auth.checkIsInRole("user", "admin"),
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

      const nft = await NftModel.findOne({
        _id: req.params.nftId,
      })
      .populate("currentOrderListingId", "isSold price supply totalSupplyOnSale supplySold")
      .populate("marketplaceId", "companyName domain")

      if (!nft) {
        return res.status(404).json({
          success: false,
          message: "No NFT found against provided nftId",
        });
      }

      // code to rename domain to username 
      let obj = JSON.stringify(nft);
      obj = JSON.parse(obj);
      obj.marketplaceId.username = obj.marketplaceId.domain;
      delete obj.marketplaceId.domain;
            
      return res.status(200).json({
        success: true,
        data: obj,
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
		auth.checkIsInRole("user", "admin"),
		async function (req, res, next) {
			try {
				const checkAttributes = ["nftId", "dropId", "price", "supply"];
				let isERC1155 = true
				if (req.body.supply == undefined) isERC1155 = false;
				if(isERC1155) checkAttributes.push('supply')

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

        // if (new BigNumber(req.body.price).isGreaterThan(0) == false) {
        //   return res.status(400).json({
        //     success: false,
        //     message: "price must be greater than 0!",
        //   });
        // }


        const stripeMinimumLimitInCents = parseInt(process.env.STRIPE_PROCESSING_MINIMUM_VALUE_IN_CENTS) / 100;
				if (new BigNumber(req.body.price).isGreaterThan(stripeMinimumLimitInCents) == false) {
					return res.status(400).json({
						success: false,
						message: `price must be greater than ${stripeMinimumLimitInCents} usd`,
					});
				}

        // if (!MarketplaceModel.findById(req.body.marketplaceId)) {
        //   return res.status(400).json({
        //     success: false,
        //     message: "Marketplace not registered",
        //   });
        // }
  
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

				if(NFT.totalSupply < req.body.supply){
					return res.status(400).json({
						success: false,
						message: "Given supply must be less than the NFT's total supply.",
					});
				}

        if(NFT.isBatchCreated == false){
					return res.status(400).json({
						success: false,
						message: "Nft not created on Blockchain yet.",
					});
				}

				const nftOwner = await NftOwnerModel.findOne({
					ownerId: req.user._id,
					nftId: req.body.nftId
				})

				if(!nftOwner){
					return res.status(400).json({
						success: false,
						message: "Only owner can add nft into the drop",
					});
				}

				if(nftOwner.supply < req.body.supply){
					return res.status(400).json({
						success: false,
						message: "Insufficient supply.",
					});
				}
				const marketplace = {
					userId: req.user._id,
					dropId: req.body.dropId,
					nftId: req.body.nftId,
					collectionId: NFT.collectionId,
					price: req.body.price,
					supply: req.body.supply,
          totalSupplyOnSale: req.body.supply
				}


				const marketPlace = await OrderListingModel.create(marketplace);

				console.log("MarketPlace: ", marketPlace);
				drop.NFTIds.push(req.body.nftId);
				drop.totalNFTs = drop.totalNFTs + 1;
				NFT.dropId = req.body.dropId;
				NFT.currentOrderListingId = marketPlace._id;
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

//We need to set different price of each NFT
//For now we are setting same price of each NFT 
assetRouter
	.route("/collection")
	.put(
		auth.verifyToken,
		verifyUser,
		auth.checkIsInRole("user", "admin"),
		async function (req, res, next) {
			try {
				const checkAttributes = ["collectionId", "dropId", "price"];

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

				if (new BigNumber(req.body.price).isGreaterThan(0) == false) {
					return res.status(400).json({
						success: false,
						message: "price must be greater than 0!",
					});
				}

        const drop = await dropModel.findById(req.body.dropId)
        .populate({
            path: "NFTIds",
            select: "collectionId",
          });
          console.log("DROP : ", drop);
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
							"Unable to add Collection to drop, Drop is not in editable state!",
					});
				}

        if(drop.NFTIds.length > 0){
          if(drop.NFTIds[0].collectionId.toString() !== req.body.collectionId){
            return res.status(400).json({
              success: false,
              message: "Nft's of only one collection can be added to drop.",
            });
         }
        }

				const collection = await CollectionModel.findById(req.body.collectionId);
				if (!collection) {
					return res.status(404).json({
						success: false,
						message: "collection not found against provided collection Id!",
					});
				}

        if(collection.userId.equals(req.user._id) === false){
					return res.status(400).json({
						success: false,
						message: "Only owner can add collection to drop.",
					});
				}

				if (collection.dropId != undefined) {
					if (collection.dropId == req.body.dropId) {
						return res.status(400).json({
							success: false,
							message: "collection is already assigned to requested Drop!",
						});
					} else {
						return res.status(400).json({
							success: false,
							message: "collection is already assigned to another Drop!",
						});
					}
				}

				const NFTs = await NftModel.find({
          collectionId: req.body.collectionId
        });

        if(NFTs.length < 1){
          return res.status(400).json({
						success: false,
						message: "The collection is empty.",
					});
        }

        for(let i=0; i< NFTs.length; i++){
          if(NFTs[i].isBatchCreated === false){
            return res.status(400).json({
              success: false,
              message: `NFT ${NFTs[i]._id} is not created on Blockchain yet.` 
            })
          }
          if (NFTs[i].dropId != null) {
            return res.status(400).json({
              success: false,
              message: `One or more NFTs are assigned to another drop` 
            })
          }
        }

        const nftOwner = await NftOwnerModel.find({
					nftId: {$in : collection.nftId}
				})

        for(let i=0; i<nftOwner.length; i++){
          if(nftOwner[i].ownerId.equals(req.user._id) === false)
            return res.status(400).json({
              success: false,
              message: "Nft " + nftOwner[i].nftId + " has more than One Owner.",
            });
        }

        let marketplace=[];
        for(let i = 0; i<collection.nftId.length; i++){
          const marketplaceData = {
            userId: req.user._id,
            dropId: req.body.dropId,
            nftId: collection.nftId[i],
            collectionId: req.body.collectionId,
            price: req.body.price,
            supply: NFTs[i].totalSupply,
            totalSupplyOnSale: NFTs[i].totalSupply
          }
				  marketplace.push(await OrderListingModel.create(marketplaceData));
        }
        marketplace = marketplace.map(data => data._id)

				console.log("MarketPlace: ", marketplace);
				drop.NFTIds.push(...collection.nftId);
				drop.totalNFTs = collection.nftId.length;
				collection.dropId = req.body.dropId;

        for(let i=0;i< marketplace.length; i++){
          await NftModel.updateOne({
              _id : collection.nftId[i]
            },{
              currentOrderListingId : marketplace[i],
              dropId: req.body.dropId
            })
        }

				await collection.save();
				await drop.save();

				return res.status(200).json({
					success: true,
					message: "Collection added to drop successfully!",
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
  .delete(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
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
        // let result = await UserModel.findOne({
        // 	email: req.user.email,
        // });
        // console.log("result : ", result);

        // if (!result) {
        // 	return res.status(404).json({
        // 		success: false,
        // 		message: "user dont exist against this walletAddress",
        // 	});
        // }
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
        let marketDrop = await OrderListingModel.findOne({
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
    auth.checkIsInRole("user", "admin"),
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
              totalNFTs: Number(dropNft.totalNFTs) - Number(1)
            }
          );
        }

        const deletionReport = await OrderListingModel.deleteOne({
          nftId: nft._id,
          dropId: dropNft._id, 
        });
        console.log('orderlisting deletion report: ', deletionReport)
        if(Number(dropNft.totalNFTs) - Number(1) === 0){
          await collectionModel.updateOne({
            dropId: dropNft._id
          },{
            dropId: null
          });
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

// assetRouter
//   .route("/nft")
//   .put(
//     auth.verifyToken,
//     verifyUser,
//     auth.checkIsInRole("user", "admin"),
//     async function (req, res, next) {
//       try {
//         const checkAttributes = ["nftId", "dropId", "price"];
//         let isERC1155 = true;
//         if (req.body.supply == undefined) isERC1155 = false;
//         if (isERC1155) checkAttributes.push("supply");

//         const missingAttribute = checkMissingAttributes(
//           req.body,
//           checkAttributes
//         );
//         if (missingAttribute != null) {
//           return res.status(400).json({
//             success: false,
//             message: missingAttribute + " not found in request body!",
//           });
//         }

//         const emptyAttributes = checkEmptyAttributes(req.body, checkAttributes);
//         if (emptyAttributes != null) {
//           return res.status(400).json({
//             success: false,
//             message: emptyAttributes + " was empty in request body!",
//           });
//         }
//         // const user = await UserModel.findOne({
//         // 	walletAddress: req.user.walletAddress,
//         // });

//         // if (!user) {
//         // 	return res.status(400).json({
//         // 		success: false,
//         // 		message: "user dont exist against this walletAddress",
//         // 	});
//         // }
//         if (isERC1155 && req.body.supply < 1) {
//           return res.status(400).json({
//             success: false,
//             message: "supply must be 1 or greater!",
//           });
//         }

//         if (new BigNumber(req.body.price).isGreaterThan(0) == false) {
//           return res.status(400).json({
//             success: false,
//             message: "price must be greater than 0!",
//           });
//         }

//         const drop = await dropModel.findById(req.body.dropId);
//         if (!drop) {
//           return res.status(404).json({
//             success: false,
//             message: "Drop not found against provided Drop Id!",
//           });
//         }
//         if (drop.status != "draft") {
//           return res.status(404).json({
//             success: false,
//             message:
//               "Unable to add NFT to drop, Drop is not in editable state!",
//           });
//         }

//         const NFT = await NftModel.findById(req.body.nftId);
//         if (!NFT) {
//           return res.status(404).json({
//             success: false,
//             message: "NFT not found against provided NFT Id!",
//           });
//         }

//         if (NFT.dropId != undefined) {
//           if (NFT.dropId == req.body.dropId) {
//             return res.status(400).json({
//               success: false,
//               message: "NFT is already assigned to requested Drop!",
//             });
//           } else {
//             return res.status(400).json({
//               success: false,
//               message: "NFT is already assigned to another Drop!",
//             });
//           }
//         }
//         const marketplace = {
//           userId: req.user._id,
//           dropId: req.body.dropId,
//           nftId: req.body.nftId,
//           collectionId: NFT.collectionId,
//           price: req.body.price,
//         };

//         if (isERC1155) marketplace.supply = req.body.supply;

//         const marketPlace = await OrderListingModel.create(marketplace);

//         console.log("MarketPlace: ", marketPlace);
//         drop.NFTIds.push(req.body.nftId);
//         drop.totalNFTs = drop.totalNFTs + 1;
//         NFT.dropId = req.body.dropId;
//         NFT.currentOrderListingId = marketPlace._id;
//         await NFT.save();
//         await drop.save();

//         return res.status(200).json({
//           success: true,
//           message: "NFT added to drop successfully!",
//         });
//       } catch (err) {
//         console.log("error (try-catch) : " + err);
//         return res.status(500).json({
//           success: false,
//           error: err,
//         });
//       }
//     }
//   );

assetRouter
  .route("/status/pending")
  .put(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
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
    auth.checkIsInRole("user", "admin"),
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

        const statusEnum = dropModel.schema.path("status").enumValues;
        const status = req.params.status;
        console.log("status: ", statusEnum);
        if (statusEnum.indexOf(status) == -1) {
          return res.status(400).json({
            success: false,
            message: "Requested status is not available",
          });
        }

        const marketplace = await getMarketplace(req.query.marketplaceId)
        if (!marketplace.success) {
          return res.status(400).json(marketplace)
        }

        let data = await dropModel.find({
          status,
          marketplaceId: req.query.marketplaceId
        });  

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

// assetRouter.route("/saleType/:saleType/:start/:end").get(
//   // auth.verifyToken,
//   // verifyUser,
//   // auth.checkIsInRole("user", "admin"),
//   async function (req, res, next) {
//     try {
//       const start = req.params.start;
//       const end = req.params.end;

//       const checkPagination = validatePaginationParams(start, end);
//       if (checkPagination.success == false) {
//         return res.status(400).json({
//           success: false,
//           message: checkPagination.message,
//         });
//       }

//       const saleType = dropModel.schema.path("saleType").enumValues;
//       console.log("saleType: ", saleType);
//       if (saleType.indexOf(req.params.saleType) == -1) {
//         return res.status(400).json({
//           success: false,
//           message: " Requested param is not present in Drop schema!",
//         });
//       }

//       const marketplace = await getMarketplace(req.query.marketplaceId)
//       if (!marketplace.success) {
//         return res.status(400).json(marketplace)
//       }

//       const drops = await dropModel.find({
//         saleType: req.params.saleType,
//         marketplaceId: req.query.marketplaceId,
//         status: { $in: ['pending', 'active', 'closed']} 
//       });
//       console.log("drops: ", drops);
//       if (drops.length === 0) {
//         return res.status(200).json({
//           success: true,
//           data: [],
//         });
//       }

//       const reverse = drops.reverse();
//       const result = reverse.slice(start, end);

//       return res.status(200).json({
//         success: true,
//         data: result,
//       });
//     } catch (err) {
//       console.log("error (try-catch) : " + err);
//       return res.status(500).json({
//         success: false,
//         error: err,
//       });
//     }
//   }
// );

module.exports = assetRouter;
