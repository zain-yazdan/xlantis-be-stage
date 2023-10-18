var express = require("express");
var router = express.Router();

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
const { v4: uuidv4 } = require('uuid');

const DropModel = require("../../models/DropModel");
const NftModel = require("../../models/NFTModel");
const NftOwnerModel = require("../../models/NFTOwnersData");
const OrderListing = require("../../models/OrderListingModel");
const UserModel = require("../../models/UserModel");
const StripeModel = require("../../models/USDDepositRequestModel");
const CollectionModel = require("../../models/CollectionModel");
const TradeHistoryModel = require("../../models/TradeHistory");

const BidModel = require("../../models/BidModel");
const stripe = require("stripe")(process.env.STRIPE_API_KEY);

const id = require("ipfs-http-client/src/id");
// const marketplaceModel = require("../../models/v1-sso/OrderListing");
const {
  approvePaymentToken,
  buyNFT,
  estimateBuy,
} = require("../utils/silent-wallet");
const { findDropById } = require("../utils/drop");
const {
  getNFTByIdWithAssociatedCollection,
  getNFTById,
} = require("../utils/nft");
const { getUserById } = require("../utils/users");
const {
  getTxCostSummary,
  sellNFT,
  buyNFT: buyNFTFromListing,
  getMyNFTs,
  getNFTs,
} = require("../utils/routes-utils/order-listing");

router
	.route("/buy")
	.post(
		auth.verifyToken,
		verifyUser,
		auth.checkIsInRole("user", "admin"),
		async function (req, res, next) {
      var isSupplyUpdated = false;
			try {
        // input validation
				const requestBody = ["orderListingId", "supply"];
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
				if(req.body.supply < 1){
					return res.status(400).json({
						success: false,
						message: "Supply must be greater than 0.",
					});
				}

        // checking order listing

        const orderListing = await OrderListing.findById(req.body.orderListingId);
				if (!orderListing) {
					return res.status(400).json({
						success: false,
						message: "Order listing not found againt the orderListingId",
					});
				}

        // drop validation

				const dropResult = await findDropById(orderListing.dropId);
				if(!dropResult.success){
					return res.status(400).json({
						success: false,
						message: dropResult.message,
					});	
				}
				if (dropResult.drop.status !== "active") {
					return res.status(400).json({
						success: false,
						message: "Drop is not active yet",
					});
				}

        // nft validation

        const nftData = await NftModel.findById(orderListing.nftId).populate({
          path: "collectionId",
          select: 'nftContractAddress contractType'
        });
				if(!nftData){
					return res.status(400).json({
						success: false,
						message: 'nft data not found',
					});
				}

				if (nftData.ownerId.equals(req.user._id)) {
          return res.status(400).json({
            success: false,
            message: "Owner can not buy his own NFT.",
          });
        }

        // accounts (user and stripe) validation
        
        const super_admin = await UserModel.findOne({
          walletAddress: process.env.SUPER_ADMIN_WALLET_ADDRESS,
          role: "super-admin",
        });
        if (!super_admin) {
          return res.status(404).json({
            success: false,
            message: 'super-admin not setup'
          });
        }
        if (super_admin.stripeAccountId == undefined) {
          return res.status(400).json({
            success: false,
            message: 'super-admin stripe account not setup'
          });
        }
        const owner = await UserModel.findById(nftData.ownerId);
        if (!owner) {
          return res.status(404).json({
            success: false,
            message: 'nft owner not found'
          });
        }
        if (owner.stripeAccountId == undefined) {
          return res.status(400).json({
            success: false,
            message: 'nft owner stripe account not setup'
          });
        }
        const minter = await UserModel.findById(nftData.minterId);
        if (!minter) {
          return res.status(404).json({
            success: false,
            message: 'nft minter not found'
          });
        }
        if (minter.stripeAccountId == undefined) {
          return res.status(400).json({
            success: false,
            message: 'nft minter stripe account not setup'
          });
        }

        // buying supply validation

        if (req.body.supply > orderListing.supply) {
					return res.status(400).json({
						success: false,
						message: `Buy request rejected. Ordered NFT supply exceeds the available supply i.e. ${orderListing.supply}`
					});
				}

        if(orderListing.supply - req.body.supply < 0) {
          return res.status(400).json({
						success: false,
						message: `Buy request rejected. Ordered NFT supply exceeds the available supply i.e. ${orderListing.supply}.`
					});
        }

        const amount = orderListing.price * req.body.supply * 100;
        const stripeMaximumLimitInCents = parseInt(process.env.STRIPE_PROCESSING_MAXIMUM_VALUE_IN_CENTS);

        if (amount >= stripeMaximumLimitInCents) 
        {
          return res.status(400).json({
            success: false,
            message: 'total purchase bill exceeds the stripe single charge limit'
          });
          
        }
         const idempotencyKey = uuidv4();

        // reduce supply from order listing

        await OrderListing.updateOne({ _id: req.body.orderListingId }, { 
          $inc: { supply: -(req.body.supply) }
        });
        isSupplyUpdated = true;
       
        // expiry time calculation
        const timeStep = process.env.STRIPE_SESSION_EXPIRY_STEP_IN_MINUTES;
        const now = new Date();
        let expiresAt = new Date(now.getTime() + timeStep * 60 * 1000);
        expiresAt = Math.floor(expiresAt / 1000)

        let image = nftData.nftURI
        const format = nftData.nftFormat
        const imageFormats = JSON.parse(process.env.IMAGE_NFT_FORMATS_SUPPORTED);
        if (imageFormats.indexOf(format) === -1) {
          image = nftData.previewImageURI
        }

        // creating stripe session URL
        const session = await stripe.checkout.sessions.create({
					line_items: [
					{
					price_data: {
						currency: 'usd',
						product_data: {
							name: nftData.title,
							description: nftData.description,
							images: [image]
						},
						unit_amount: orderListing.price * 100,
						},
						quantity: req.body.supply,
					},
					],
					mode: 'payment',
           metadata: {
            idempotencyKey, //To retrieve it in the webhook and verify it.
          },
					// client_reference_id: NFT.ownerId,
					// customer_details:{
					//     ownerId: NFT.ownerId
					// },
          success_url: `${process.env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}&active=true`,
					cancel_url: `${process.env.STRIPE_CANCEL_URL}?session_id={CHECKOUT_SESSION_ID}&active=false`,				
          expires_at: expiresAt
        },{
          idempotencyKey,
        });
					// console.log("Session : ",session)
				await StripeModel.create({
					ownerId: nftData.ownerId,
					buyerId: req.user._id,
					nftId: nftData._id,
					checkoutSessionId: session.id,
					paymentMode: 'nft-purchase',
					supply : req.body.supply,
          idempotencyKey,
          orderListingId: req.body.orderListingId
				})

				return res.status(200).json({
					success: true,
					stripeSession: session.url,
          checkoutSessionId: session.id
				});
			} catch (error) {
				console.log("error (try-catch) : " + error);

        if(isSupplyUpdated === true) {
          await OrderListing.updateOne({ _id: req.body.orderListingId }, { 
            $inc: { supply: req.body.supply }
          });
        }

				return res.status(500).json({
					success: false,
					err: error,
				});
			}
		}
	);

router
  .route("/buy/tx-cost-summary/:dropId/:nftId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin", "user"),
    async function (req, res, next) {
      return await getTxCostSummary(req, res);
    }
  );

router
  .route("/collection/sale")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const requestBody = ["collectionId", "price"];
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

        const collection = await CollectionModel.findById(
          req.body.collectionId
        ).populate({ path: "nftId", select: "dropId ownerId" });
        console.log("Collection : ", collection);
        if (!collection) {
          return res.status(400).json({
            success: false,
            message: "Collection not found against collection Id.",
          });
        }
        if (!collection.userId.equals(req.user._id)) {
          return res.status(400).json({
            success: false,
            message: "Only Owner can put Collection on sale.",
          });
        }
        if (collection.isOnSale) {
          return res.status(400).json({
            success: false,
            message: "This Collection is already on sale.",
          });
        }

        for (let i = 0; i < collection.nftId.length; i++) {
          if (collection.nftId[i].dropId !== null) {
            return res.status(400).json({
              success: false,
              message: `Collection cannot be put on sale because NFT ${collection.nftId[i]._id} is already on sale.`,
            });
          }

          if (!collection.nftId[i].ownerId.equals(req.user._id)) {
            return res.status(400).json({
              success: false,
              message: `NFT ${collection.nftId[i]._id} already sold out.`,
            });
          }
        }
        const marketplaceData = await OrderListing.create({
          userId: req.user._id,
          collectionId: collection._id,
          price: req.body.price,
          saleType: "fixed-price",
        });
        const collectionReport = await collection.updateOne({
          isOnSale: true,
          currentOrderListingId: marketplaceData._id,
        });
        console.log({ collectionReport });
        return res.status(200).json({
          success: true,
          marketplaceData,
          message: "Collection successfully put on sale",
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
  .route("/collection/buy")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const requestBody = ["collectionId"];
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

        const collection = await CollectionModel.findById(
          req.body.collectionId
        );
        if (!collection) {
          return res.status(400).json({
            success: false,
            message: "Collection not found against Collection Id.",
          });
        }

        const marketplace = await OrderListing.findById(
          collection.currentOrderListingId
        );
        if (!marketplace) {
          return res.status(400).json({
            success: false,
            message: "Collection not found in marketplace.",
          });
        }
        if (collection.userId.equals(req.user._id)) {
          return res.status(400).json({
            success: false,
            message: "Owner can not buy his own Collection.",
          });
        }

        if (marketplace.saleType != "fixed-price") {
          return res.status(400).json({
            success: false,
            message: "Collection is not on fixed price sale.",
          });
        }

        let tradeHistory = [];
        for (let i = 0; i < collection.nftId.length; i++) {
          tradeHistory["nftId"] = collection.nftId[i];
          tradeHistory["sellerId"] = collection.userId;
          tradeHistory["buyerId"] = req.user._id;
          tradeHistory["soldAt"] = Date.now();
          tradeHistory["saleType"] = "fixed-price";
          tradeHistory["unitPrice"] = marketplace.price;
        }
        await TradeHistoryModel.create(tradeHistory);

        const collectionReport = await collection.updateOne({
          userId: req.user._id,
          isOnSale: false,
          currentOrderListingId: null,
        });
        console.log({ collectionReport });

        const nftReport = await NftModel.updateMany(
          {
            _id: { $in: collection.nftId },
          },
          {
            ownerId: req.user._id,
          }
        );
        console.log({ collectionReport });

        await marketplace.updateOne({
          isSold: true,
          soldAt: Date.now(),
        });
        return res.status(200).json({
          success: true,
          collectionNewOwner: collection.userId,
          message: "Collection successfully bought",
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
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await sellNFT(req, res);
    }
  );

router
  .route("/nft/buy")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await buyNFTFromListing(req, res);
    }
  );

router
  .route("/my-nfts/:saleType/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await getMyNFTs(req, res);
    }
  );

router
  .route("/nfts/:saleType/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await getNFTs(req, res);
    }
  );

router
  .route("/user")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const marketplace = await OrderListing.findOne({
          userId: req.user._id,
        });
        return res.status(200).json({
          success: true,
          MarketplaceData: marketplace,
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
  .route("/user/featured")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const marketplace = await OrderListing.findOne({
          userId: req.user._id,
          isFeatured: true,
        });
        return res.status(200).json({
          success: true,
          MarketplaceData: marketplace,
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
