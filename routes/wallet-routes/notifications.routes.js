var express = require("express");
var assetRouter = express.Router();

const auth = require("../../middlewares/auth");
const { checkIsInRole } = require("../../middlewares/auth");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});

const {
  hideNotifications,
  getNotifications,
} = require("../utils/routes-utils/notifications");

assetRouter
  .route("/hide")
  .patch(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await hideNotifications(req, res);
    }
  );

assetRouter
  .route("/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await getNotifications(req, res);
    }
  );

module.exports = assetRouter;
