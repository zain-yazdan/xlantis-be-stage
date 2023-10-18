const express = require("express");
const router = express.Router();

const jwtUtil = require("../utils/jwt");

const auth = require("../middlewares/auth");
const { checkIsInRole } = require("../middlewares/authCheckRole");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});
const {
  checkMissingAttributes,
  checkEmptyAttributes,
} = require("../utils/requestBody");
const UserModel = require("../models/UserModel");
const { generateUsername } = require("unique-username-generator");
const Web3 = require("web3");
const web3 = new Web3();

router
  .route("/admins/counts")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        let totalAdmins = await UserModel.countDocuments({
          role: "admin",
        });

        let totalVerifiedAdmins = await UserModel.countDocuments({
          role: "admin",
          isVerified: true,
        });

        let totalUnverifiedAdmins = await UserModel.countDocuments({
          role: "admin",
          isVerified: false,
        });

        let totalEnabledAdmins = await UserModel.countDocuments({
          role: "admin",
          isVerified: true,
          isEnabled: true,
        });

        let totalDisabledAdmins = await UserModel.countDocuments({
          role: "admin",
          isVerified: true,
          isEnabled: false,
        });

        return res.status(200).json({
          success: true,
          counts: {
            totalAdmins,
            totalVerifiedAdmins,
            totalUnverifiedAdmins,
            totalEnabledAdmins,
            totalDisabledAdmins,
          },
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
  .route("/admins/enabled")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        let result = await UserModel.find({
          isVerified: true,
          isEnabled: true,
          role: "admin",
        });
        console.log("result : ", result);

        return res.status(200).json({
          success: true,
          admins: result,
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
  .route("/admins/disabled")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        let result = await UserModel.find({
          isVerified: true,
          isEnabled: false,
          role: "admin",
        });
        console.log("result : ", result);

        return res.status(200).json({
          success: true,
          admins: result,
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

// router.post(
// 	"/admin",
// 	auth.verifyToken,
// 	verifyUser,
// 	checkIsInRole("super-admin"),
// 	async function (req, res, next) {
// 		try {
// 			if (req.body.walletAddress == undefined) {
// 				return res.status(400).json({
// 					success: false,
// 					message: "New admin wallet address not found in request body.",
// 				});
// 			}
// 			if (req.body.walletAddress == "") {
// 				return res.status(400).json({
// 					success: false,
// 					message: "New admin wallet address found empty in request body.",
// 				});
// 			}

// 			if (req.user.walletAddress != process.env.SUPER_ADMIN_WALLET_ADDRESS) {
// 				return res.status(401).json({
// 					success: false,
// 					message: "Unauthorized super admin.",
// 				});
// 			}

// 			const filter = { walletAddress: req.body.walletAddress };
// 			let user = await UserModel.findOne(filter);

// 			if (user) {
// 				return res.status(404).json({
// 					success: false,
// 					message: "Admin already registered against this wallet address",
// 				});
// 			}

// 			user = await UserModel.create({
// 				walletAddress: req.body.walletAddress,
// 				role: "admin",
// 			});

// 			return res.status(200).json({
// 				success: true,
// 				message: "Super Admin created successfully",
// 			});
// 		} catch (error) {
// 			console.log("error (try-catch) : " + error);
// 			return res.status(500).json({
// 				success: false,
// 				err: error,
// 			});
// 		}
// 	}
// );

router
  .route("/admins/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        if (!req.params.start) {
          return res.status(400).json({
            success: false,
            message: "start not found in the params",
          });
        }

        if (!req.params.end) {
          return res.status(400).json({
            success: false,
            message: "end not found in the params",
          });
        }
        let admins = await UserModel.find({
          role: "admin",
        });
        // console.log("admins : ", admins);

        let paginationResult = admins.slice(req.params.start, req.params.end);

        return res.status(200).json({
          success: true,
          Admins: paginationResult,
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
  .route("/admins/unverified")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        let result = await UserModel.find({
          isVerified: false,
          role: "admin",
        });
        console.log("result : ", result);

        return res.status(200).json({
          success: true,
          unverifiedAdmins: result,
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
  .route("/admins/unverified/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        if (!req.params.start) {
          return res.status(400).json({
            success: false,
            message: "start not found in the params",
          });
        }

        if (!req.params.end) {
          return res.status(400).json({
            success: false,
            message: "end not found in the params",
          });
        }
        let admins = await UserModel.find({
          isVerified: false,
          role: "admin",
        });
        console.log("admins : ", admins);

        let paginationResult = admins.slice(req.params.start, req.params.end);
        return res.status(200).json({
          success: true,
          unverifiedAdmins: paginationResult,
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
  .route("/admin/verify")
  .patch(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        const requiredAttributes = ["adminId"];

        const missingParam = checkMissingAttributes(
          req.body,
          requiredAttributes
        );
        if (missingParam != null) {
          return res.status(400).json({
            success: false,
            message: missingParam + " not found in request body!",
          });
        }

        const emptyParam = checkEmptyAttributes(req.body, requiredAttributes);
        if (emptyParam != null) {
          return res.status(400).json({
            success: false,
            message: emptyParam + " was empty in request body!",
          });
        }

        let user = await UserModel.findOne({
          _id: req.body.adminId,
        });
        console.log("user : ", user);

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "admin dont exist against this adminId",
          });
        }

        let result = await user.updateOne({
          isVerified: true,
          isEnabled: true,
        });

        return res.status(200).json({
          success: true,
          message: "Admin verified.",
          admin: result,
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
  .route("/enable")
  .patch(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        const requiredAttributes = ["adminId"];

        const missingParam = checkMissingAttributes(
          req.body,
          requiredAttributes
        );
        if (missingParam != null) {
          return res.status(400).json({
            success: false,
            message: missingParam + " not found in request body!",
          });
        }

        const emptyParam = checkEmptyAttributes(req.body, requiredAttributes);
        if (emptyParam != null) {
          return res.status(400).json({
            success: false,
            message: emptyParam + " was empty in request body!",
          });
        }

        let user = await UserModel.findOne({
          _id: req.body.adminId,
        });
        console.log("user : ", user);

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "user dont exist against this walletAddress",
          });
        }

        await user.updateOne({ isEnabled: true });

        return res.status(200).json({
          success: true,
          message: "Admin status Enabled.",
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
  .route("/disable")
  .patch(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        const requiredAttributes = ["adminId"];

        const missingParam = checkMissingAttributes(
          req.body,
          requiredAttributes
        );
        if (missingParam != null) {
          return res.status(400).json({
            success: false,
            message: missingParam + " not found in request body!",
          });
        }

        const emptyParam = checkEmptyAttributes(req.body, requiredAttributes);
        if (emptyParam != null) {
          return res.status(400).json({
            success: false,
            message: emptyParam + " was empty in request body!",
          });
        }

        let user = await UserModel.findOne({
          _id: req.body.adminId,
        });
        console.log("user : ", user);

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "user dont exist against this walletAddress",
          });
        }

        await user.updateOne({ isEnabled: false });

        return res.status(200).json({
          success: true,
          message: "Admin status disabled.",
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
  .route("/addAdmin")
  .post(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("super-admin"),
    async (req, res, next) => {
      try {
        if (req.body.walletAddress == undefined) {
          return res.status(400).json({
            success: false,
            message: "walletAddress not found in request body.",
          });
        }
        if (req.body.walletAddress == "") {
          return res.status(400).json({
            success: false,
            message: "walletAddress found empty in request body.",
          });
        }
        if (!web3.utils.isAddress(req.body.walletAddress)) {
          return res.status(400).json({
            success: false,
            message: "It is not a valid wallet address.",
          });
        }

        let user = await UserModel.findOne({
          walletAddress: req.body.walletAddress,
        });

        if (!user) {
          let username = generateUsername("-", 2);
          user = await UserModel.create({
            walletAddress: req.body.walletAddress,
            role: "admin",
            username,
          });
          return res.status(200).json({
            success: true,
            message: "Admin added successfully...",
          });
        } else {
          return res.status(400).json({
            success: false,
            message: "Admin already added...",
            AdminData: user,
          });
        }
      } catch (error) {
        console.log("error (try-catch) : " + error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    }
  );

module.exports = router;
