require("dotenv").config();

const {
  validatePaginationParams,
  checkMissingAttributes,
  checkEmptyAttributes,
} = require("../../../utils/request-body");

const NotificationModel = require("../../../models/NotificationModel");

const { sendNotification } = require("../../../utils/notification");

const hideNotifications = async (req, res) => {
  try {
    const requiredAttributes = ["notificationIds"];

    const missingAttribute = checkMissingAttributes(
      req.body,
      requiredAttributes
    );

    if (missingAttribute != null) {
      return res.status(400).json({
        success: false,
        message: `${missingAttribute} not found in request body!`,
      });
    }

    const emptyAttributes = checkEmptyAttributes(req.body, requiredAttributes);

    if (emptyAttributes != null) {
      return res.status(400).json({
        success: false,
        message: `${emptyAttributes} was empty in request body!`,
      });
    }

    const notificationIds = req.body.notificationIds;

    const updateResult = await NotificationModel.updateMany(
      {
        _id: { $in: notificationIds },
      },
      {
        $set: { isRead: true },
      }
    );

    if (updateResult.nModified === 0) {
      return res.status(400).json({
        success: false,
        message: "No notifications found with the provided Ids.",
      });
    }

    const response = {
      success: true,
      message: "Notification status updated successfully.",
    };

    return res.status(200).json(response);
  } catch (error) {
    console.log("error (try-catch) : " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};


const generateNotifications = async (req, res) => {
  try {
    const notification = await NotificationModel.create({
      userId: req.body.userId,
      message: req.body.message,
    });
    sendNotification(notification);
    return res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.log("error (try-catch) : " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};

module.exports = { hideNotifications, generateNotifications };
