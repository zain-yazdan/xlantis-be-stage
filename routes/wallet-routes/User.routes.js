var express = require("express");
var router = express.Router();

const UserModel = require("../../models/UserModel");
const { verifyEmail } = require("../../actions/verifyEmail");
const bcrypt = require("bcrypt");
const { BCRYPT_SALT_ROUNDS } = require("../../config/bcrypt");
const jwtUtil = require("../../utils/jwt");

// const forgotPasswordModule = require("../../actions/sendForgotPasswordEmail");
// const forgotPasswordModel = require("../../models/v2-wallet-login/ForgotPasswordModel");

const NftModel = require("../../models/NFTModel");
const dropModel = require("../../models/DropModel");
const collectionModel = require("../../models/CollectionModel");

const { generateUsername } = require("unique-username-generator");
const auth = require("../../middlewares/auth");
const {checkDomain} = require("../utils/routes-utils/user");
// const { checkIsInRole } = require('../../middlewares/authCheckRole');
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});
const {
  checkMissingAttributes,
  checkEmptyAttributes,
} = require("../../utils/request-body");
const Web3 = require("web3");
const web3 = new Web3();

router
  .route("/profile")
  .put(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const walletAddress = req.user.walletAddress;

        const filter = { walletAddress: walletAddress };
        const user = await UserModel.findOne(filter);
        if (!user) {
          return res.status(400).json({
            success: false,
            message:
              "Request body walletAddress doesn't match any registered user",
          });
        }
        console.log("user: ", user);

        const possibleAttributes = [
          "username",
          "bio",
          "email",
          "imageURL",
          "bannerURL",
        ];
        const updation = {};

        for (let i = 0; i < possibleAttributes.length; ++i) {
          if (req.body[possibleAttributes[i]] != undefined)
            updation[possibleAttributes[i]] = req.body[possibleAttributes[i]];
        }

        const report = await user.updateOne(updation);
        console.log("report: ", report);
        if (!report.acknowledged) {
          return res.status(400).json({
            success: false,
            message: "Updation failure: No updation parameters provided",
          });
        }

        return res.status(200).json({
          success: true,
          message: "User updated successfully",
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
  .route("/admin/add-info")
  .put(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const filter = { walletAddress: req.user.walletAddress };
        const user = await UserModel.findOne(filter);
        if (!user) {
          return res.status(400).json({
            success: false,
            message:
              "Request body wallet address doesn't match any registered user",
          });
        }
        console.log("user: ", user);

        if (user.isInfoAdded) {
          return res.status(200).json({
            success: true,
            message: "Admin information is already added",
          });
        }

        const requiredParameters = [
          "domain",
          "companyName",
          "designation",
          "industryType",
          "reasonForInterest",
        ];
        const missingAttribute = checkMissingAttributes(
          req.body,
          requiredParameters
        );
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: missingAttribute + " not found in request body",
          });
        }

        const emptyAttributes = checkEmptyAttributes(
          req.body,
          requiredParameters
        );
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: emptyAttributes + " was empty in request body",
          });
        }

        console.log({ ...req.body });
        const updation = { ...req.body, isInfoAdded: true };

        const report = await user.updateOne(updation);
        console.log("report: ", report);

        return res.status(200).json({
          success: true,
          message: "Admin information added successfully",
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
  .route("/admin/update-info")
  .put(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const requiredParameters = [
          "companyName",
          "bio",
          "imageURL",
          "bannerURL",
          "username",
        ];

        let givenAttributes = {};
        for (let i = 0; i < requiredParameters.length; i++) {
          if (req.body[requiredParameters[i]]) {
            givenAttributes[requiredParameters[i]] =
              req.body[requiredParameters[i]];
          }
        }

        console.log("Given Attributes : ", givenAttributes);
        await UserModel.updateOne(
          {
            _id: req.user._id,
          },
          givenAttributes
        );

        return res.status(200).json({
          success: true,
          message: "Admin information updated successfully",
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
  .route("/getCounts")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        var nftResult = await NftModel.find({
          ownerId: req.user._id,
        });

        var dropResult = await dropModel.find({
          userId: req.user._id,
        });

        var collectionResult = await collectionModel.find({
          userId: req.user._id,
        });

        return res.status(200).json({
          success: true,
          NFTscount: nftResult.length,
          Dropscount: dropResult.length,
          Collectionscount: collectionResult.length,
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
  .route("/marketplace")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const marketplace = await UserModel.find({
          _id: req.user._id,
          domain: req.user.domain,
        }).select("_id imageURL bannerURL");
        return res.status(200).json({
          success: true,
          MarketplaceData: marketplace,
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
  .route("/marketplace/featured")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const marketplace = await UserModel.findOne({
          isFeatured: true,
        }).select("_id imageURL bannerURL domain");
        return res.status(200).json({
          success: true,
          MarketplaceData: marketplace,
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

// router.post("/forgotPassword", async function (req, res, next) {
// 	try {
// 		if (!req.body.email)
// 			return res
// 				.status(400)
// 				.json({ success: false, message: "email not found in the body" });

// 		var user = await UserModel.findOne({ email: req.body.email });

// 		if (!user)
// 			return res
// 				.status(404)
// 				.json({ success: false, message: "User not found" });

// 		await forgotPasswordModel.deleteMany({ userEmail: req.body.email });

// 		let mailSent = await forgotPasswordModule.sendResetPasswordPin(
// 			req.body.email
// 		);
// 		if (!mailSent)
// 			return res.send("Unable to send reset password pin, try again later");

// 		res
// 			.status(200)
// 			.json({ success: true, message: "Reset Password email sent" });
// 	} catch (error) {
// 		console.log("error (try-catch) : " + error);
// 		return res.status(500).json({ success: false, err: error });
// 	}
// });

//verify reset password pin
router.post("/verifyResetPasswordPin", async (req, res, next) => {
  try {
    if (!req.body.email)
      return res
        .status(400)
        .json({ success: false, message: "email not found in the body" });

    if (!req.body.pin)
      return res
        .status(400)
        .json({ success: false, message: "pin not found in the body" });

    var result = await forgotPasswordModel.findOne({
      userEmail: req.body.email,
      resetPasswordToken: req.body.pin,
    });

    if (!result)
      return res
        .status(401)
        .json({ success: false, message: "wrong pin entered" });

    result.verified = true;
    result.save();
    // await forgotPasswordModel.deleteMany({userEmail: req.body.email, resetPasswordToken: req.body.pin});

    return res
      .status(200)
      .json({ success: true, message: "Correct Pin entered" });
  } catch (error) {
    console.error(error);
    res.status(500).send();
  }
});

//verify reset password pin
router.post("/resetPassword", async (req, res, next) => {
  try {
    if (!req.body.password)
      return res
        .status(400)
        .json({ success: false, message: "password not found in the body" });

    if (!req.body.email)
      return res
        .status(400)
        .json({ success: false, message: "email not found in the body" });

    var result = await forgotPasswordModel.findOne({
      userEmail: req.body.email,
    });

    if (!result || !result.verified)
      return res
        .status(200)
        .json({ success: false, message: "pin not verified yet" });

    var user = await UserModel.findOne({ email: req.body.email });
    user.password = await bcrypt.hash(req.body.password, BCRYPT_SALT_ROUNDS);
    await user.save();

    await forgotPasswordModel.deleteMany({ userEmail: req.body.email });

    return res
      .status(200)
      .json({ success: true, message: "Password successfully changed" });
  } catch (error) {
    console.error(error);
    res.status(500).send();
  }
});

// email verification
router.get("/emailVerification/:email/:token", async (req, res, next) => {
  try {
    const verified = verifyEmail(req.params.email, req.params.token);
    if (!verified) return res.status(401).send("Invalid Url");

    res.status(200).send("User Successfully verified.");
  } catch (error) {
    console.error(error);
    res.status(500).send();
  }
});

router
  .route("/profile")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const userData = await UserModel.findById(req.user._id).select(
          "username walletAddress imageURL bannerURL bio"
        );
        return res.status(200).json({
          success: true,
          userData,
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
  .route("/check-domain")
  .get(
    // auth.verifyToken,
    // verifyUser,
    // auth.checkIsInRole("user", "admin"),
    async function (req, res, next){
      return  await checkDomain(req, res)
    });

module.exports = router;
