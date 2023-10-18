var express = require("express");
var router = express.Router();

const auth = require("../../middlewares/auth");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});

const BalanceHistoryModel = require("../../models/BalanceHistoryModel");

router
  .route("/my-history")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin", "super-admin"),
    async function (req, res, next) {
      try {
        const history = await BalanceHistoryModel.find({
          userId: req.user._id,
        });

        return res.status(200).json({
          success: true,
          history,
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
  .route("/")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        const history = await BalanceHistoryModel.find({
        });

        
        return res.status(200).json({
          success: true,
          history
        });
      } catch (error) {
        console.log("error (try-catch) : " + error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
  });


module.exports = router;
