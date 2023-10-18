var express = require("express");
var assetRouter = express.Router();

const auth = require("../../middlewares/auth");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});

const {
	getMyNFTs,
	getMyNFTsOnSale,
	getNFTs,
	getNFTsOnSale,
	addNFTs,
	getSingleNFT,
	getNFTsByCollection,
	updateMintedNFT,
	updateNFT,
	getNFTAndCollectionData,
	getCollection,
	getRarities,
} = require("../utils/routes-utils/nft");
const NftModel = require("../../models/NFTModel");
const NftOwnersModel = require("../../models/NFTOwnersData");

assetRouter
  .route("/myNFTs/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await getMyNFTs(req, res);
    }
  );

assetRouter
  .route("/my-nft/:nftId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        if (!req.params.nftId) {
          return res.status(400).json({
            success: false,
            message: `nftId not found in request params!`,
          });
        }
  
        if (req.params.nftId == "") {
          return res.status(400).json({
            success: false,
            message: `nftId not found in request params!`,
          });
        }
  
        let NFT = await NftModel
        .findById(req.params.nftId)
        .populate({
          path: "currentOrderListingId",
          select: "price isSold supply totalSupplyOnSale supplySold",
        });
  
        if (!NFT) {
          return res.status(400).json({
            success: false,
            message: `nft not found`,
          });
        }

        const nftOwnerData = await NftOwnersModel.findOne({
          ownerId: req.user._id,
          nftId: req.params.nftId
        });

        if (!nftOwnerData) {
          return res.status(400).json({
            success: false,
            message: `Caller does'nt own any supply of this NFT.`,
          });
        }

        NFT = JSON.stringify(NFT);
        NFT = JSON.parse(NFT);
        NFT.UserOwnedSupply = nftOwnerData.supply;

        return res.status(200).json({
          success: true,  
          data: NFT,
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
  .route("/my-nfts/:onSale")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await getMyNFTsOnSale(req, res);
    }
  );

assetRouter
  .route("/nfts/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await getNFTs(req, res);
    }
  );

assetRouter
	.route("/rarities")
	.get(
		auth.verifyToken,
		verifyUser,
		auth.checkIsInRole("user", "admin"),
		async function (req, res, next) {
			return await getRarities(req, res);
		}
	);

assetRouter
  .route("/nfts/:onSale")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await getNFTsOnSale(req, res);
    }
  );

assetRouter
  .route("/addNFTs")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin", "user"),
    async function (req, res, next) {
      return await addNFTs(req, res);
    }
  );

assetRouter
  .route("/getSingleNFT/:nftId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        if (!req.params.nftId) {
          return res.status(400).json({
            success: false,
            message: `nftId not found in request params!`,
          });
        }
  
        if (req.params.nftId == "") {
          return res.status(400).json({
            success: false,
            message: `nftId not found in request params!`,
          });
        }
  
        const NFT = await NftModel
        .findById(req.params.nftId)
        .populate({
          path: "currentOrderListingId",
          select: "price isSold supply totalSupplyOnSale supplySold",
        });
  
        if (!NFT) {
          return res.status(400).json({
            success: false,
            message: `nft not found`,
          });
        }
        return res.status(200).json({
          success: true,  
          data: NFT,
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
  .route("/getNFTsByCollection/:collectionId/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await getNFTsByCollection(req, res);
    }
  );

assetRouter
  .route("/minted")
  .put(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await updateMintedNFT(req, res);
    }
  );

assetRouter
  .route("/:nftId")
  .put(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await updateNFT(req, res);
    }
  );

assetRouter
  .route("/:nftId/:collectionId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await getNFTAndCollectionData(req, res);
    }
  );

assetRouter
  .route("/:collectionId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await getCollection(req, res);
    }
  );

module.exports = assetRouter;
