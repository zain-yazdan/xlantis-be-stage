const express = require("express");
const router = express.Router();
const axios = require('axios')
const jwtUtil = require("../../utils/jwt");
const Web3 = require("web3");
const web3 = new Web3();
web3.setProvider(process.env.WEB_SOCKET);
const auth = require("../../middlewares/auth");

const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});
const {
  checkMissingAttributes,
  checkEmptyAttributes,
  validatePaginationParams,
} = require("../../utils/request-body");

const UserModel = require("../../models/UserModel");
const DropModel = require("../../models/DropModel");
const {
  getCountByFilter,
  getAllByFilter,
  getOneByFilter,
} = require("../utils/database-query");
const { checkNull } = require("../utils/validateRequest");

const {
  getAdminCount,
  getAdminByFilter,
  getUserById,
} = require("../utils/users");
// const DropModelV2 = require("../../models/v2-wallet-login/DropModel");

const NFTPropertiesModel = require("../../models/NFTPropertiesModel");
const { convertMaticInUsd } = require("../../actions/crypto-convert");
const PlatformFeeRequests = require("../../models/PlatformFeeModel");
const Earnings = require("../../models/EarningsModel");

router
  .route("/admins/total-counts")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        let totalAdmins = await UserModel.countDocuments({
          role: "admin",
        });

        return res.status(200).json({
          success: true,
          TotalAdmins: totalAdmins,
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
  .route("/platform-fee")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        let platform_fee = await PlatformFeeRequests.findOne({
          userId: req.user._id,
          isAccepted: "accepted"
        });
    
        const { platformFee } = platform_fee;

        return res.status(200).json({
          success: true,
          platformFee
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
  .route("/admins/counts")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        const result = checkNull("User Type", req.query.userType);

        if (!result.success) {
          return res.status(400).json(result);
        }
        let totalAdmins,
          totalVerifiedAdmins,
          totalUnverifiedAdmins,
          totalEnabledAdmins,
          totalDisabledAdmins;

        if (req.query.userType == "v1") {
          totalAdmins = await getAdminCount({});

          totalVerifiedAdmins = await getAdminCount({
            isVerified: true
          });

          totalUnverifiedAdmins = await getAdminCount({
            isVerified: false
          });

          totalEnabledAdmins = await getAdminCount({
            isEnabled: true,
          });

          totalDisabledAdmins = await getAdminCount({
            isEnabled: false,
          });
        } else if (req.query.userType == "v2") {
          totalAdmins = await getAdminCount({},false);

          totalVerifiedAdmins = await getAdminCount({
            isVerified: true
          },
          false
          );

          totalUnverifiedAdmins = await getAdminCount({
            isVerified: false
          },
          false
          );

          totalEnabledAdmins = await getAdminCount(
            {
              isEnabled: true,
            },
            false,
          );

          totalDisabledAdmins = await getAdminCount(
            {
              isEnabled: false,
            },
            false
          );
        } else {
          return res.status(400).json({
            success: false,
            message: "Invalid value for user type.",
          });
        }
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
    auth.checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        const qResult = checkNull("User Type", req.query.userType, true);

        if (!qResult.success) {
          return res.status(400).json(qResult);
        }
        let result;
        if (req.query.userType == "v1") {
          result = await getAdminByFilter({
            isEnabled: true,
          });
        } else if (req.query.userType == "v2") {
          result = await getAdminByFilter(
            {
              isEnabled: true,
            },
            false
          );
        } else {
          return res.status(400).json({
            success: false,
            message: "Invalid value for user type.",
          });
        }

        console.log("result : ", result.admins);

        return res.status(200).json(result);
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
    auth.checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        const qResult = checkNull("User Type", req.query.userType, true);

        if (!qResult.success) {
          return res.status(400).json(qResult);
        }
        let result;
        if (req.query.userType == "v1") {
          result = await getAdminByFilter({
            isEnabled: false,
          });
        } else if (req.query.userType == "v2") {
          result = await getAdminByFilter(
            {
              isEnabled: false,
            },
            false
          );
        } else {
          return res.status(400).json({
            success: false,
            message: "Invalid value for user type.",
          });
        }

        console.log("result : ", result);

        return res.status(200).json(result);
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
  .route("/admins/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        const result = validatePaginationParams(
          req.params.start,
          req.params.end
        );
        if (!result.success) {
          return res.status(400).json(result);
        }
        const qResult = checkNull("User Type", req.query.userType, true);

        if (!qResult.success) {
          return res.status(400).json(qResult);
        }

        let paginationResult;
        if (req.query.userType == "v1") {
          let admins = await getAdminByFilter({}, true, "omit");
          // console.log("admins : ", admins);

          paginationResult = admins.admins.slice(
            req.params.start,
            req.params.end
          );
        } else if (req.query.userType == "v2") {
          let admins = await getAdminByFilter({}, false, "omit");
          // console.log("admins : ", admins);

          paginationResult = admins.admins.slice(
            req.params.start,
            req.params.end
          );
        } else {
          return res.status(400).json({
            success: false,
            message: "Invalid value for user type.",
          });
        }
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
	.route("/admins/verified/:start/:end")
	.get(
		auth.verifyToken,
		verifyUser,
		auth.checkIsInRole("super-admin"),
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
				if (req.query.userType == undefined) {
					return res.status(400).json({
						success: false,
						message: "User Type not found in query params.",
					});
				}

				if (req.query.userType == "") {
					return res.status(400).json({
						success: false,
						message: "User Type empty in query params.",
					});
				}
				let admins;
				if (req.query.userType == "v1") {
					admins = await UserModel.find({
						isVerified: true,
						role: "admin",
						userType: "v1",
					});
				} else if (req.query.userType == "v2") {
					admins = await UserModel.find({
						isVerified: true,
						role: "admin",
						userType: "v2",
					});
				} else {
					return res.status(400).json({
						success: false,
						message: "Invalid value for user type.",
					});
				}

				console.log("admins : ", admins);

				let paginationResult = admins.slice(req.params.start, req.params.end);
				return res.status(200).json({
					success: true,
					verifiedAdmins: paginationResult,
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
	.route("/admins/verified")
	.get(
		auth.verifyToken,
		verifyUser,
		auth.checkIsInRole("super-admin"),
		async function (req, res, next) {
			try {
				if (req.query.userType == undefined) {
					return res.status(400).json({
						success: false,
						message: "User Type not found in query params.",
					});
				}

				if (req.query.userType == "") {
					return res.status(400).json({
						success: false,
						message: "User Type empty in query params.",
					});
				}
				let result;
				if (req.query.userType == "v1") {
					result = await UserModel.find({
						isVerified: true,
						role: "admin",
						userType: "v1",
					});
				} else if (req.query.userType == "v2") {
					result = await UserModel.find({
						isVerified: true,
						role: "admin",
						userType: "v2",
					});
				} else {
					return res.status(400).json({
						success: false,
						message: "Invalid value for user type.",
					});
				}

				console.log("result : ", result);

				return res.status(200).json({
					success: true,
					verifiedAdmins: result,
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
    auth.checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        const qResult = checkNull("User Type", req.query.userType, true);

        if (!qResult.success) {
          return res.status(400).json(qResult);
        }
        let result;
        if (req.query.userType == "v1") {
          result = await getAdminByFilter({}, true, false);
        } else if (req.query.userType == "v2") {
          result = await getAdminByFilter({}, false, false);
        } else {
          return res.status(400).json({
            success: false,
            message: "Invalid value for user type.",
          });
        }

        console.log("result : ", result);

        return res.status(200).json({
          success: true,
          unverifiedAdmins: result.admins,
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
    auth.checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        const result = validatePaginationParams(
          req.params.start,
          req.params.end
        );
        if (!result.success) {
          return res.status(400).json(result);
        }
        const qResult = checkNull("User Type", req.query.userType, true);

        if (!qResult.success) {
          return res.status(400).json(qResult);
        }
        let admins;
        if (req.query.userType == "v1") {
          admins = await getAdminByFilter({}, true, false);
        } else if (req.query.userType == "v2") {
          admins = await getAdminByFilter({}, false, false);
        } else {
          return res.status(400).json({
            success: false,
            message: "Invalid value for user type.",
          });
        }

        console.log("admins : ", admins);

        let paginationResult = admins.admins.slice(
          req.params.start,
          req.params.end
        );
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
  .route("/admin/remove")
  .patch(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin"),
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

        let user = await UserModel.findById(req.body.adminId);

        if (!user) {
          return res.status(400).json({
            success: false,
            message: "user doesn't exist against this Id."
          });
        }

        let result = {
          success : true
        };
        if(user.isVerified == false){
          result.deletedUser = await user.deleteOne();
          result.message = "Admin deleted successfully.";
        }
        else{
          result.message = "Cannot delete Admin because it verified.";
        }

        

        return res.status(200).json(result);
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
    auth.checkIsInRole("super-admin"),
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

        let user = await getOneByFilter(
          "",
          UserModel,
          {
            _id: req.body.adminId,
          },
          "user dont exist against this Id"
        );

        if (!user.success) {
          return res.status(400).json(user);
        }

        let result = await user.document.updateOne({
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
    auth.checkIsInRole("super-admin"),
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

        let user = await getOneByFilter(
          "",
          UserModel,
          {
            _id: req.body.adminId,
          },
          "user dont exist against this Id"
        );

        if (!user.success) {
          return res.status(400).json(user);
        }

        await user.document.updateOne({ isEnabled: true });

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
    auth.checkIsInRole("super-admin"),
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

        let user = await getOneByFilter(
          "",
          UserModel,
          {
            _id: req.body.adminId,
          },
          "user dont exist against this Id"
        );

        if (!user.success) {
          return res.status(400).json(user);
        }

        await user.document.updateOne({ isEnabled: false });

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
  .route("/template")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin", "user", "super-admin"),
    async function (req, res, next) {
      try {
        // let result = await UserModelV1.findOne({
        // 		email: req.user.email,
        // 	});
        // console.log("result : ", result);

        // if (!result) {
        // 	return res.status(400).json({
        // 		success: false,
        // 		message: "user dont exist against this email",
        // 	});
        // }
        const templates = await NFTPropertiesModel.find({
          userType: "super-admin"
        });

        return res.status(200).json({
          success: true,
          templates: templates,
          // message: "Template created successfully.",
        });
      } catch (error) {
        console.log("try-catch error: " + error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    }
  );

router
  .route("/template/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin", "user", "super-admin"),
    async function (req, res, next) {
      try {
        // let result = await UserModelV1.findOne({
        // 	email: req.user.email,
        // });

        // console.log("result : ", result);

        // if (!result) {
        // 	return res.status(400).json({
        // 		success: false,
        // 		message: "user dont exist against this email",
        // 	});
        // }

        const result = validatePaginationParams(
          req.params.start,
          req.params.end
        );
        if (!result.success) {
          return res.status(400).json(result);
        }
        const templates = await NFTPropertiesModel.find();

        let paginationResult = templates.slice(
          req.params.start,
          req.params.end
        );
        return res.status(200).json({
          success: true,
          templates: paginationResult,
          // message: "Template created successfully.",
        });
      } catch (error) {
        console.log("try-catch error: " + error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    }
  );
router
  .route("/drop/feature")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        let featuredDrop = await DropModel.findOne({
          isFeaturedSuperAdmin: true,
        });

        return res.status(200).json({
          success: true,
          FeaturedDrop: featuredDrop,
        });
      } catch (err) {
        console.log("error (try-catch) : " + err);
        return res.status(500).json({
          success: false,
          error: err,
        });
      }
    }
  );
router
  .route("/drop/feature")
  .patch(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        const result = checkNull("Drop Id", req.body.dropId);

        if (!result.success) {
          return res.status(400).json(result);
        }

        let drop = await getOneByFilter(
          "",
          DropModel,
          {
            _id: req.body.dropId,
          },
          "Drop not found against drop Id."
        );

        if (!drop.success) {
          return res.status(400).json(drop);
        }
        console.log("Drop : ", drop.document);

        if (drop.document.isFeaturedSuperAdmin) {
          return res.status(400).json({
            success: false,
            message: "Drop already featured.",
          });
        }
        await DropModel.updateOne(
          {
            isFeaturedSuperAdmin: true,
          },
          {
            isFeaturedSuperAdmin: false,
          }
        );
        await drop.document.updateOne({ isFeaturedSuperAdmin: true });

        return res.status(200).json({
          success: true,
          message: "Drop Featured successfully.",
        });
      } catch (err) {
        console.log("error (try-catch) : " + err);
        return res.status(500).json({
          success: false,
          error: err,
        });
      }
    }
  );

router
  .route("/marketplace/feature")
  .patch(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        const qResult = checkNull("Marketplace Id", req.body.marketplaceId);

        if (!qResult.success) {
          return res.status(400).json(qResult);
        }

        let marketplaceData = await getOneByFilter(
          "",
          UserModel,
          {
            _id: req.body.marketplaceId,
          },
          "Marketplace Data dont exist against this Id."
        );

        if (!marketplaceData.success) {
          return res.status(400).json(marketplaceData);
        }

        if (marketplaceData.document.isFeatured) {
          return res.status(400).json({
            success: false,
            message: "Marketplace already featured.",
          });
        }
        await UserModel.updateOne(
          {
            isFeatured: true,
          },
          {
            isFeatured: false,
          }
        );

        let result = await marketplaceData.document.updateOne({
          isFeatured: true,
        });

        return res.status(200).json({
          success: true,
          message: "Marketplace featured successfully.",
          data: result,
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
  .route("/balance")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin"),
    async function (req, res, next) {
    
      const superAdminWalletAddress = process.env.SUPER_ADMIN_WALLET_ADDRESS;
      const masterWalletAddress = process.env.MASTER_WALLET_ADDRESS;
      
      const superAdminWeibalance = await web3.eth.getBalance(superAdminWalletAddress);
      const superAdminMaticbalance = web3.utils.fromWei(superAdminWeibalance, "ether");
      
      const masterWalletWeiBalance = await web3.eth.getBalance(masterWalletAddress);
      const masterWalletMaticBalance = web3.utils.fromWei(masterWalletWeiBalance, "ether");
      
      const superAdminBalanceUSD = await convertMaticInUsd(superAdminMaticbalance)
      const masterWalletBalanceUSD = await convertMaticInUsd(masterWalletMaticBalance)

      return res.status(200).json({
        success: true,
        superAdmin: {
          usd: superAdminBalanceUSD,
          matic: {
            inMatic: superAdminMaticbalance,
            inWei: superAdminWeibalance,
          },
        },
        masterWallet: {
          usd: masterWalletBalanceUSD,
          matic: {
            inMatic: masterWalletMaticBalance,
            inWei: masterWalletWeiBalance,
          },
        }
      });
    });


module.exports = router;
