var express = require("express");
var assetRouter = express.Router();

const auth = require("../../middlewares/auth");
const { checkIsProfileAdded } = require("../../middlewares/profileMiddleware");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});
const {
  addNFTs,
  getSingleNFT,
  getNFTsByCollection,
  updateMintedNFT,
  updateNFT,
  getNFTAndCollectionData,
  getMyNFTs,
} = require("../utils/routes-utils/nft");

assetRouter
  .route("/myNFTs/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      return await getMyNFTs(req, res);
    }
  );
assetRouter
  .route("/addNFTs")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
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
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      return await getSingleNFT(req, res);
    }
  );

assetRouter
  .route("/getNFTsByCollection/:collectionId/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      return await getNFTsByCollection(req, res);
    }
  );

assetRouter
  .route("/minted")
  .put(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      return await updateMintedNFT(req, res);
    }
  );

assetRouter
  .route("/:nftId")
  .put(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      return await updateNFT(req, res);
    }
  );

assetRouter
  .route("/:nftId/:collectionId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      return await getNFTAndCollectionData(req, res);
    }
  );

assetRouter
  .route("/:collectionId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      return await getCollection(req, res);
    }
  );

module.exports = assetRouter;
