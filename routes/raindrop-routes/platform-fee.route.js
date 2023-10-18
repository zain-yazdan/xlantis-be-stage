var express = require("express");
var router = express.Router();
const { checkIsInRole } = require("../middlewares/authCheckRole");
const { checkIsProfileAdded } = require("../middlewares/profileMiddleware");
const {
  checkMissingAttributes,
  checkEmptyAttributes,
} = require("../utils/requestBody");
const auth = require("../middlewares/auth");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});

const UserModel = require("../models/UserModel");
// const PlatformFeeRequests = require("../models/PlatformFeeModel");

const { setPlatformFee, getPlatformFee } = require("../utils/platformFeeCalls");

// router
// 	.route("/admin")
// 	.post(
// 		auth.verifyToken,
// 		verifyUser,
// 		checkIsInRole("admin"),
// 		async function (req, res, next) {
// 			try {
// 				if (req.body.platformFee == undefined) {
// 					return res.status(400).json({
// 						success: false,
// 						message: "name not found in request body",
// 					});
// 				}
// 				if (req.body.platformFee === "") {
// 					return res.status(400).json({
// 						success: false,
// 						message: "name was empty in request body",
// 					});
// 				}

// 				const user = await UserModel.findOne({
// 					walletAddress: req.user.walletAddress,
// 				});

//                 if(req.body.platformFee < 0){
//                     return res.status(400).json({
//                         success: false,
//                         message: "Platform fee must be grater than 0"
//                     })
//                 }
//                 if(req.body.platformFee > 100){
//                     return res.status(400).json({
//                         success: false,
//                         message: "Platform fee must be less than 100"
//                     })
//                 }
//                 let fee = Number(req.body.platformFee) * 10000;
// 				await PlatformFeeRequests.create({
// 					userId: user._id,
// 					platformFee: fee
// 				})
//                 // let transaction = await Contract.methods.setPlatformFee(fee)
//                 // .send({from:user.walletAddress})
//                 // .then(console.log);
// 				// console.log("TRansaction : ", transaction)
// 				return res.status(200).json({
// 					success: true,
// 					message: "Platform fee request successfully made.",
//                     // txHash: transaction.transactionHash
// 				});
// 			} catch (error) {
// 				console.log("catch-error : ", error);
// 				return res.status(500).json({
// 					success: false,
// 					err: error,
// 				});
// 			}
// 		}
// 	);

// router
// 	.route("/super-admin/platform-fee/accept")
// 	.patch(
// 		auth.verifyToken,
// 		verifyUser,
// 		checkIsInRole("super-admin"),
// 		async function (req, res, next) {
// 			try {

// 				const user = await UserModel.findOne({
// 					walletAddress: req.user.walletAddress,
// 				});

//                 // let fee = Number(req.body.platformFee) * 10000;
// 				let fee = await PlatformFeeRequests.findOne({
// 					userId: user._id,
// 				})
//                 let transaction = await Contract.methods.setPlatformFee(fee.platformFee)
//                 .send({from:user.walletAddress})
//                 .then(console.log);
// 				console.log("TRansaction : ", transaction)
// 				await PlatformFeeRequests.updateOne({
// 					userId: user._id,
// 				},{
// 					isAccepted: "accepted"
// 				})
// 				return res.status(200).json({
// 					success: true,
// 					message: "Platform fee successfully updated.",
//                     txHash: transaction.transactionHash
// 				});
// 			} catch (error) {
// 				console.log("catch-error : ", error);
// 				return res.status(500).json({
// 					success: false,
// 					err: error,
// 				});
// 			}
// 		}
// 	);

// router
// 	.route("/super-admin/platform-fee/reject")
// 	.patch(
// 		auth.verifyToken,
// 		verifyUser,
// 		checkIsInRole("super-admin"),
// 		async function (req, res, next) {
// 			try {

// 				const user = await UserModel.findOne({
// 					walletAddress: req.user.walletAddress,
// 				});

//                 // let fee = Number(req.body.platformFee) * 10000;
// 				let fee = await PlatformFeeRequests.findOne({
// 					userId: user._id,
// 				})
//                 // let transaction = await Contract.methods.setPlatformFee(fee.platformFee)
//                 // .send({from:user.walletAddress})
//                 // .then(console.log);
// 				// console.log("TRansaction : ", transaction)
// 				let result = await PlatformFeeRequests.updateOne({
// 					userId: user._id,
// 				},{
// 					isAccepted:"rejected"
// 				})
// 				return res.status(200).json({
// 					success: true,
// 					message: "Platform fee rejected.",
// 					result
//                     // txHash: transaction.transactionHash
// 				});
// 			} catch (error) {
// 				console.log("catch-error : ", error);
// 				return res.status(500).json({
// 					success: false,
// 					err: error,
// 				});
// 			}
// 		}
// 	);

// router
// 	.route("/admin/platform-fee/status")
// 	.get(
// 		auth.verifyToken,
// 		verifyUser,
// 		checkIsInRole("admin"),
// 		async function (req, res, next) {
// 			try {
// 				const user = await UserModel.findOne({
// 					walletAddress: req.user.walletAddress,
// 				});

// 				// if (!user) {
// 				// 	return res.status(400).json({
// 				// 		success: false,
// 				// 		message: "user dont exist against this walletAddress",
// 				// 	});
// 				// }
// 				let fee = await PlatformFeeRequests.find({
// 					userId: user._id
// 				})
//                 // let transaction = await Contract.methods.getPlatformFee().call()
//                 // .then(console.log)
// 				// transaction /=10000;
//                 // console.log("Transaction: ",transaction)
// 				return res.status(200).json({
// 					success: true,
// 					PlatformFee: fee
// 				});
// 			} catch (error) {
// 				console.log("catch-error : ", error);
// 				return res.status(500).json({
// 					success: false,
// 					err: error,
// 				});
// 			}
// 		}
// 	);

router
  .route("/")
  .post(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin", "super-admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        if (req.body.platformFee == undefined) {
          return res.status(400).json({
            success: false,
            message: "name not found in request body",
          });
        }
        if (req.body.platformFee === "") {
          return res.status(400).json({
            success: false,
            message: "name was empty in request body",
          });
        }

        console.log("Req user: ", req.user);
        if (req.body.platformFee <= 0) {
          return res.status(400).json({
            success: false,
            message: "Platform fee must be grater than 0",
          });
        }
        if (req.body.platformFee > 100) {
          return res.status(400).json({
            success: false,
            message: "Platform fee must be less than 100",
          });
        }
        let fee = Number(req.body.platformFee) * 10000;
        // let transaction = await Contract.methods.setPlatformFee(fee)
        // .send({from:req.user.walletAddress})
        // .then(console.log);
        let transaction = await setPlatformFee(req.user.walletAddress, fee);
        console.log("TRansaction : ", transaction);
        return res.status(200).json({
          success: true,
          message: "Platform fee successfully updated.",
          txHash: transaction.transactionHash,
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
    checkIsInRole("admin", "super-admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        // const user = await UserModel.findOne({
        // 	walletAddress: req.user.walletAddress,
        // });

        // if (!user) {
        // 	return res.status(400).json({
        // 		success: false,
        // 		message: "user dont exist against this walletAddress",
        // 	});
        // }

        // let transaction = await Contract.methods.getPlatformFee().call()
        // .then(console.log)
        let transaction = await getPlatformFee();
        transaction /= 10000;
        console.log("Transaction: ", transaction);
        return res.status(200).json({
          success: true,
          CurrentPlatformFee: transaction,
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

module.exports = router;
