var express = require("express");
var assetRouter = express.Router();

const auth = require("../../middlewares/auth");
const { checkIsInRole } = require("../../middlewares/auth");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});
const {
  checkMissingAttributes,
  checkEmptyAttributes,
  constructObject,
  validatePaginationParams,
} = require("../../utils/request-body");

const {
  getMyNFTs,
  addNFTs,
  getSingleNFT,
  getNFTsByCollection,
  updateMintedNFT,
  updateNFT,
  getNFTAndCollectionData,
  getCollection,
} = require("../utils/routes-utils/nft");

assetRouter
  .route("/myNFTs/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await getMyNFTs(req, res);
    }
  );
assetRouter
  .route("/addNFTs")
  .post(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin", "user"),
    async function (req, res, next) {
      return await addNFTs(req, res);
    }
  );

assetRouter
  .route("/getSingleNFT/:nftId")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await getSingleNFT(req, res);
    }
  );

assetRouter
  .route("/getNFTsByCollection/:collectionId/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await getNFTsByCollection(req, res);
    }
  );

assetRouter
  .route("/minted")
  .put(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await updateMintedNFT(req, res);
    }
  );

assetRouter
  .route("/:nftId")
  .put(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await updateNFT(req, res);
    }
  );

assetRouter
  .route("/:nftId/:collectionId")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await getNFTAndCollectionData(req, res);
    }
  );

assetRouter
  .route("/:collectionId")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await getCollection(req, res);
    }
  );

module.exports = assetRouter;
