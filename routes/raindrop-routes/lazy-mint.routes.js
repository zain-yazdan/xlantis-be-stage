var express = require("express");
var assetRouter = express.Router();
const auth = require("../../middlewares/auth");
const { checkIsProfileAdded } = require("../../middlewares/profileMiddleware");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});
const {
  lazyMintNFT,
  createVoucher,
} = require("../utils/routes-utils/lazy-mint");

assetRouter
  .route("/NFT")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      return await lazyMintNFT(req, res);
    }
  );

assetRouter
  .route("/voucher")
  .patch(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      return await createVoucher(req, res);
    }
  );

module.exports = assetRouter;
