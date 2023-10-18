var express = require("express");
var router = express.Router();
const auth = require('../../middlewares/auth');
const { validatePaginationParams } = require("../../utils/request-body");
const passport = require("passport");
const verifyUser = passport.authenticate('jwt', { session: false });

const MarketplaceModel = require("../../models/MarketplaceModel");
const UserModel = require("../../models/UserModel");

router
  .route("/")
  .get(
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
        const verifiedAdmins = await UserModel.find({
          role:"admin",
          isVerified: true
        });
        const marketplaces = await MarketplaceModel.find({
          adminId: { $in: verifiedAdmins}
        }).select("domain companyName logoImage");

        const reverse = marketplaces.reverse();
        const data = reverse.slice(start, end);

        return res.status(200).json({
            success: true,
            data
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
  .route("/:marketplaceId")
  .get(
    async function (req, res, next) {
      try {
        const marketplaceId = req.params.marketplaceId;
        if (!marketplaceId) {
          return res.status(400).json({
            success: false,
            message: 'marketplace id not found in request'
          })
        }
        if (marketplaceId == '') {
          return res.status(400).json({
            success: false,
            message: 'marketplace id empty in request'
          })
        }

        const marketplace = await MarketplaceModel.findById(marketplaceId)
        
        if(!marketplace) {
          return res.status(400).json({
            success: false,
            message: 'marketplace not found against provided marketplace id'
          })
        }
        return res.status(200).json({
            success: true,
            data: marketplace
        });
      } catch (error) {
        console.log("error (try-catch) : " + error);
        return res.status(500).json({
          success: false,
          err: error.message,
        });
      }
    }
  );

module.exports = router;
