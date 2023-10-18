var express = require("express");
var assetRouter = express.Router();

const auth = require("../../middlewares/auth");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});

const {
  validatePaginationParams,
  checkMissingAttributes,
  checkEmptyAttributes,
} = require("../../utils/request-body");

const {
  hideNotifications,
  generateNotifications,
} = require("../utils/routes-utils/notifications");
const Notifications = require("../../models/NotificationModel");
assetRouter
  .route("/hide")
  .patch(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      return await hideNotifications(req, res);
    }
  );

assetRouter
  .route("/")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const start = req.query.start || String(0);
        const end = req.query.end || 10;
    
        const checkPagination = validatePaginationParams(start, end);
        if (checkPagination.success == false) {
          return res.status(400).json({
            success: false,
            message: checkPagination.message,
          });
        }

        const queryFilter = { userId: req.user._id }
        const isRead = req.query.isRead;
        if (isRead) {
          if (isRead != 'true' && isRead != 'false') {
            return res.status(400).json({
              success: false,
              message: 'invalid isRead query parameter value',
            })
          }
          queryFilter.isRead = isRead
        }
        let notifications = await Notifications.find(queryFilter);
        notifications = notifications.reverse();
        notifications = notifications.slice(start, end);
    
        return res.status(200).json({
          success: true,
          data: notifications,
        });
      } catch (error) {
        console.log("notifications-seen-error: ", error); 
        return res.status(500).json({
          success: false,
          err: error.message,
        });
      }    
    }
  );

assetRouter.route("/generate").post(async function (req, res, next) {
  return await generateNotifications(req, res);
});

module.exports = assetRouter;
