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

const UserModel = require("../../models/UserModel");
const NFTPropertiesModel = require("../../models/NFTPropertiesModel");
const {
  createTemplate,
  createAdminTemplate,
  getAdminTemplate,
  getTemplates,
  getTemplateById,
} = require("../utils/routes-utils/nft-properties");

assetRouter
  .route("/")
  .post(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("super-admin"),
    async function (req, res, next) {
      return await createTemplate(req, res);
    }
  );

assetRouter
  .route("/admin/template")
  .post(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    async function (req, res, next) {
      return await createAdminTemplate(req, res);
    }
  );

assetRouter
  .route("/admin/template")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin", "user"),
    async function (req, res, next) {
      return await getAdminTemplate(req, res);
    }
  );

assetRouter
  .route("/")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin", "user"),
    async function (req, res, next) {
      return await getTemplates(req, res);
    }
  );

assetRouter
  .route("/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin", "user"),
    async function (req, res, next) {
      return await getTemplatesFromStartToEnd(req, res);
    }
  );

// assetRouter
// 	.route("/:id")
// 	.put(
// 		auth.verifyToken,
// 		verifyUser,
// 		checkIsInRole("admin"),
// 		async function (req, res, next) {
// 			return await getTemplateById(req,res);
// 		}
// 	);
module.exports = assetRouter;
