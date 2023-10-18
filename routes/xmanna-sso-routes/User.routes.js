var express = require("express");
var router = express.Router();

const UserModel = require("../../models/UserModel");
const { verifyEmail } = require("../../actions/verifyEmail");
const bcrypt = require("bcrypt");
const { BCRYPT_SALT_ROUNDS } = require("../../config/bcrypt");
const jwtUtil = require("../../utils/jwt");

// const forgotPasswordModule = require("../../actions/sendForgotPasswordEmail");
// const forgotPasswordModel = require("../../models/v1-sso/ForgotPasswordModel");

const NftModel = require("../../models/NFTModel");
const NftOwnerModel = require("../../models/NFTOwnersData");

const dropModel = require("../../models/DropModel");
const collectionModel = require("../../models/CollectionModel");
const {checkDomain} = require("../utils/routes-utils/user");
const fileManager = require("../../actions/fileManager");
const fs = require("fs");
const AWS = require("aws-sdk");

const { generateUsername } = require("unique-username-generator");
const auth = require("../../middlewares/auth");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});
const {
  checkMissingAttributes,
  checkEmptyAttributes,
} = require("../../utils/request-body");
const Web3 = require("web3");
const marketplaceModel = require("../../models/OrderListingModel");
const MarketplaceModel = require("../../models/MarketplaceModel");
const web3 = new Web3();

// router.post("/login",
// 	async function (req, res, next) {
// 		try {
// 			const requiredParameters = ["walletAddress", "signature"];
// 			const missingAttribute = checkMissingAttributes(req.body, requiredParameters);
// 			if (missingAttribute != null) {
// 				return res.status(400).json({
// 					success: false,
// 					message: missingAttribute + " not found in request body",
// 				});
// 			}

// 			const emptyAttributes = checkEmptyAttributes(req.body, requiredParameters);
// 			if (emptyAttributes != null) {
// 				return res.status(400).json({
// 					success: false,
// 					message: emptyAttributes + " was empty in request body",
// 				});
// 			}

// 			const rawMessage = `Welcome to RobotDrop! \n\nClick to sign in and accept the RobotDrop Terms of Service: https://RobotDrop.io/tos \n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nYour authentication status will reset after 24 hours. \n\nWallet address: ${req.body.walletAddress}`;
// 			const retrivedAddress = web3.eth.accounts.recover(rawMessage, req.body.signature);

// 			console.log('retrived_address: ', retrivedAddress)
// 			if (req.body.walletAddress != retrivedAddress) {
// 				return res.status(401).json({
// 					success: false,
// 					message: "Unauthorized access: wallet address and pink slip signatory do not match",
// 				});
// 			}

// 			const filter = { walletAddress: req.body.walletAddress }
// 			let user = await UserModel.findOne(filter);

// 			let token;
// 			const response = {
// 				success: true,
// 				message: "User logged in",
// 			}
// 			if (user) {
// 				if (user.role == "super-admin" && req.body.walletAddress != process.env.SUPER_ADMIN_WALLET_ADDRESS) {
// 					return res.status(401).json({
// 						success: false,
// 						message: "Unauthorized super admin.",
// 					});
// 				}

// 				token = await jwtUtil.sign({
// 					walletAddress: req.body.walletAddress,
// 					role: user.role,
// 					userId: user._id,
// 				});

// 				response.token = token;
// 				return res.status(200).json(response);
// 			}
// 			let username = generateUsername('-', 2);

// 			user = await UserModel.create({
// 				walletAddress: req.body.walletAddress,
// 				role: "user",
//         username
// 			})

// 			token = await jwtUtil.sign({
// 				walletAddress: req.body.walletAddress,
// 				role: user.role,
// 				userId: user._id,
// 			});

// 			response.message = 'User created and logged in';
// 			response.token = token;

// 			return res.status(200).json(response);
// 		} catch (error) {
// 			console.log("error (try-catch) : " + error);
// 			return res.status(500).json({
// 				success: false,
// 				message: 'User wallet address was empty in the request body',
// 			});
// 		}
// 	});

// router.post("/admin/signup", async function (req, res, next) {
// 	try {
// 		const requiredAttributes = ["username", "email", "password"];

// 		const missingParam = checkMissingAttributes(req.body, requiredAttributes);
// 		if (missingParam != null) {
// 			return res.status(400).json({
// 				success: false,
// 				message: missingParam + " not found in request body!",
// 			});
// 		}

// 		const emptyParam = checkEmptyAttributes(req.body, requiredAttributes);
// 		if (emptyParam != null) {
// 			return res.status(400).json({
// 				success: false,
// 				message: emptyParam + " was empty in request body!",
// 			});
// 		}

// 		if (req.body.password.length < 4) {
// 			return res.status(400).json({
// 				success: false,
// 				message: "Password length must be greater than 4!",
// 			});
// 		}

// 		var emailCheck = await UserModel.findOne({ email: req.body.email });
// 		if (emailCheck) {
// 			return res.status(409).json({
// 				success: false,
// 				message: "This Email already exists, choose another one.",
// 			});
// 		}

// 		const hashedPassword = await bcrypt.hash(
// 			req.body.password,
// 			BCRYPT_SALT_ROUNDS
// 		);

// 		await UserModel.create({
// 			email: req.body.email,
// 			username: req.body.username,
// 			password: hashedPassword,
// 			role: "admin",
// 		});
// 		console.log("new admin created");

// 		return res.status(200).json({
// 			success: true,
// 			message: "Admin Successfully Signed-up",
// 		});
// 	} catch (error) {
// 		console.log("error (try-catch) : " + error);
// 		return res.status(500).json({
// 			success: false,
// 			err: error,
// 		});
// 	}
// });
// router.post("/admin/login", async function (req, res, next) {
// 	try {
// 		const requiredAttributes = ["email", "password"];

// 		const missingParam = checkMissingAttributes(req.body, requiredAttributes);
// 		if (missingParam != null) {
// 			return res.status(400).json({
// 				success: false,
// 				message: missingParam + " not found in request body!",
// 			});
// 		}

// 		const emptyParam = checkEmptyAttributes(req.body, requiredAttributes);
// 		if (emptyParam != null) {
// 			return res.status(400).json({
// 				success: false,
// 				message: emptyParam + " was empty in request body!",
// 			});
// 		}

// 		var user = await UserModel.findOne({
// 			email: req.body.email,
// 		});
// 		// console.log("user : ", user);

// 		if (!user) {
// 			return res.status(404).json({
// 				success: true,
// 				message: "admin dont exist against this email",
// 			});
// 		}
// 		// console.log("Password : ", user.password);
// 		const validPassword = bcrypt.compareSync(req.body.password, user.password);
// 		if (!validPassword) {
// 			return res.status(400).json("Incorrect email or password entered");
// 		}

// 		let payload = {
// 			email: req.body.email,
// 			role: "admin",
// 			userId: user._id,
// 		};
// 		// console.log("PAyload : ", payload);
// 		let token = await jwtUtil.sign(payload);

// 		return res.status(200).json({
// 			success: true,
// 			token: token,
// 			message: "Admin Successfully logged-in",
// 			AdminId: user._id,
// 		});
// 	} catch (error) {
// 		console.log("error (try-catch) : " + error);
// 		return res.status(500).json({
// 			success: false,
// 			err: error,
// 		});
// 	}
// });

// router.post("/login", async function (req, res, next) {
// 	try {
// 		const requiredParameters = ["walletAddress", "signature"];
// 		const missingAttribute = checkMissingAttributes(
// 			req.body,
// 			requiredParameters
// 		);
// 		if (missingAttribute != null) {
// 			return res.status(400).json({
// 				success: false,
// 				message: missingAttribute + " not found in request body",
// 			});
// 		}

// 		const emptyAttributes = checkEmptyAttributes(req.body, requiredParameters);
// 		if (emptyAttributes != null) {
// 			return res.status(400).json({
// 				success: false,
// 				message: emptyAttributes + " was empty in request body",
// 			});
// 		}

// 		const rawMessage = `Welcome to RobotDrop! \n\nClick to sign in and accept the RobotDrop Terms of Service: https://RobotDrop.io/tos \n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nYour authentication status will reset after 24 hours. \n\nWallet address: ${req.body.walletAddress}`;
// 		const retrivedAddress = web3.eth.accounts.recover(
// 			rawMessage,
// 			req.body.signature
// 		);

// 		console.log("retrived_address: ", retrivedAddress);
// 		if (req.body.walletAddress != retrivedAddress) {
// 			return res.status(401).json({
// 				success: false,
// 				message:
// 					"Unauthorized access: wallet address and pink slip signatory do not match",
// 			});
// 		}

// 		const filter = { walletAddress: req.body.walletAddress };
// 		let user = await UserModel.findOne(filter);

// 		let token;
// 		const response = {
// 			success: true,
// 			message: "User logged in",
// 		};
// 		if (user) {
// 			if (
// 				user.role == "super-admin" &&
// 				req.body.walletAddress != process.env.SUPER_ADMIN_WALLET_ADDRESS
// 			) {
// 				return res.status(401).json({
// 					success: false,
// 					message: "Unauthorized super admin.",
// 				});
// 			}

// 			token = await jwtUtil.sign({
// 				walletAddress: req.body.walletAddress,
// 				role: user.role,
// 				userId: user._id,
// 			});

// 			response.token = token;
// 			return res.status(200).json(response);
// 		}
// 		let username = generateUsername("-", 2);

// 		user = await UserModel.create({
// 			walletAddress: req.body.walletAddress,
// 			role: "user",
// 			username,
// 		});

// 		token = await jwtUtil.sign({
// 			walletAddress: req.body.walletAddress,
// 			role: user.role,
// 			userId: user._id,
// 		});

// 		response.message = "User created and logged in";
// 		response.token = token;

// 		return res.status(200).json(response);
// 	} catch (error) {
// 		console.log("error (try-catch) : " + error);
// 		return res.status(500).json({
// 			success: false,
// 			message: "User wallet address was empty in the request body",
// 		});
// 	}
// });

router
  .route("/profile")
  .put(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const filter = { email: req.user.email };
        const user = await UserModel.findOne(filter);
        console.log("user: ", user);

        const possibleAttributes = [
          "username",
          "bio",
          "email",
          "imageURL",
          "bannerURL",
          "domain",
          "companyName",
          "designation",
          "industryType",
          "reasonForInterest",
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
    fileManager.uploadDocument.fields([
      {
        name: "marketplaceImage",
        maxCount: 1,
      },
      {
        name: "logoImage",
        maxCount: 1,
      },
    ]),
  
    async function (req, res, next) {
      try {
        const requestFiles = ['marketplaceImage', 'logoImage'];
        const missingFiles = checkMissingAttributes(req.files, requestFiles);
        if (missingFiles != null) {
          if (req.files.marketplaceImage) fileManager.DeleteFile(req.files.marketplaceImage[0].path);
          if (req.files.logoImage) fileManager.DeleteFile(req.files.logoImage[0].path);
          return res.status(400).json({
            success: false,
            message: missingFiles + " is missing in request files!",
          });
        }

        const filter = { email: req.user.email };
        const user = await UserModel.findOne(filter);
        if (!user) {
          if (req.files.marketplaceImage) fileManager.DeleteFile(req.files.marketplaceImage[0].path);
          if (req.files.logoImage) fileManager.DeleteFile(req.files.logoImage[0].path);
          return res.status(400).json({
            success: false,
            message: "Request body email doesn't match any registered user",
          });
        }
        console.log("user: ", user);

        if (user.isInfoAdded) {
          if (req.files.marketplaceImage) fileManager.DeleteFile(req.files.marketplaceImage[0].path);
          if (req.files.logoImage) fileManager.DeleteFile(req.files.logoImage[0].path);
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
          "description"
        ];
        const missingAttribute = checkMissingAttributes(
          req.body,
          requiredParameters
        );
        if (missingAttribute != null) {
          if (req.files.marketplaceImage) fileManager.DeleteFile(req.files.marketplaceImage[0].path);
          if (req.files.logoImage) fileManager.DeleteFile(req.files.logoImage[0].path);
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
          if (req.files.marketplaceImage) fileManager.DeleteFile(req.files.marketplaceImage[0].path);
          if (req.files.logoImage) fileManager.DeleteFile(req.files.logoImage[0].path);
          return res.status(400).json({
            success: false,
            message: emptyAttributes + " was empty in request body",
          });
        }

        const s3 = new AWS.S3({
          accessKeyId: process.env.S3_ACCESS_ID,
          secretAccessKey: process.env.S3_ACCESS_SECRET,
        });
  
        console.log('readings images from server...')
        let marketplaceImage = fs.readFileSync(req.files.marketplaceImage[0].path);
        let logoImage = fs.readFileSync(req.files.logoImage[0].path);

        console.log('uploading marketplace image...')
        marketplaceImage = await s3
          .upload({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: req.files.marketplaceImage[0].originalname,
            Body: marketplaceImage,
            ACL: "public-read",
          })
          .promise();

          console.log('uploading logo image')
          logoImage = await s3
          .upload({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: req.files.logoImage[0].originalname,
            Body: logoImage,
            ACL: "public-read",
          })
          .promise();

        console.log({ ...req.body });
        
        const updation = { 
          domain: req.body.domain,
          companyName: req.body.companyName,
          designation: req.body.designation,
          industryType: req.body.industryType,
          reasonForInterest: req.body.reasonForInterest,
          marketplaceImage: marketplaceImage.Location,
          logoImage: logoImage.Location,
          isInfoAdded: true 
        };

        const report = await user.updateOne(updation);
        console.log("report: ", report);

        delete updation.reasonForInterest;
        delete updation.isInfoAdded;
        delete updation.designation;
        updation["adminId"] = req.user._id;
        updation["description"] = req.body.description;

        const { website, twitter, discord, facebook, instagram } = req.body;

        if (website) updation.website = website;
        if (twitter) updation.twitter = twitter;
        if (discord) updation.discord = discord;
        if (facebook) updation.facebook = facebook;
        if (instagram) updation.instagram = instagram;

        console.log(updation);
        await MarketplaceModel.create(updation);
        
        if (req.files.marketplaceImage) fileManager.DeleteFile(req.files.marketplaceImage[0].path);
        if (req.files.logoImage) fileManager.DeleteFile(req.files.logoImage[0].path);
        return res.status(200).json({
          success: true,
          message: "Admin information added successfully",
        });
      } catch (error) {
        if (req.files.marketplaceImage) fileManager.DeleteFile(req.files.marketplaceImage[0].path);
        if (req.files.logoImage) fileManager.DeleteFile(req.files.logoImage[0].path);
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
        // var result = await UserModel.findOne({
        //   email: req.user.email,
        // });
        // console.log("result : ", result);

        // if (!result) {
        //   return res.status(404).json({
        //     success: false,
        //     message: "user dont exist against this walletAddress",
        //   });
        // }

        let nftResult;

        if (req.user.role == 'admin') {
          nftResult = await NftModel.find({
            ownerId: req.user._id,
          });
        }
        if (req.user.role == 'user') {
          nftResult = await NftOwnerModel.find({
            ownerId: req.user._id,
          });
        }

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
        if (req.user.domain == undefined) {
          return res.status(400).json({
            success: false,
            message: "Domain not found in request body.",
          });
        }

        if (req.user.domain == "") {
          return res.status(400).json({
            success: false,
            message: "Domain found empty in request body.",
          });
        }

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

    router
      .route("/admin/statistics")
      .get(
        auth.verifyToken,
        verifyUser,
        auth.checkIsInRole("user", "admin"),
        async function (req, res, next) {
          try {
            var user = await UserModel.findOne({
              email: req.user.email,
            });
            console.log("user : ", user);

            if (!user) {
              return res.status(404).json({
                success: false,
                message: "user dont exist against this email",
              });
            }

            let nftSoldFixedPrice = await marketplaceModel.find({
              userId: user._id,
              isSold: true,
              saleType: "fixed-price",
            });

            let nftSoldAuction = await marketplaceModel.find({
              userId: user._id,
              isSold: true,
              saleType: "auction",
            });

            let collection721 = await collectionModel.find({
              userId: user._id,
              contractType: "721",
            });

            let collection1155 = await collectionModel.find({
              userId: user._id,
              contractType: "1155",
            });

            let ids721 = [];
            let ids1155 = [];

            for (let i = 0; i < collection721.length; i++) {
              ids721.push(...collection721[i].nftId);
            }
            for (let i = 0; i < collection1155.length; i++) {
              ids1155.push(...collection1155[i].nftId);
            }
            console.log("ERC721 : ", ids721);
            console.log("ERC1155 : ", ids1155);

            let nftCreated721 = await NftModel.find({
              _id: { $in: ids721 },
              minterId: user._id,
            });

            let nftCreated1155 = await NftModel.find({
              _id: { $in: ids1155 },
              minterId: user._id,
            });

            let nftOnSale721 = await NftModel.find({
              _id: { $in: ids721 },
              ownerId: user._id,
              isOnSale: true,
            });

            let nftOnSale1155 = await NftModel.find({
              _id: { $in: ids1155 },
              ownerId: user._id,
              isOnSale: true,
            });

            let dropFixedPrice = await dropModel.find({
              userId: user._id,
              saleType: "fixed-price",
            });

            let dropAuction = await dropModel.find({
              userId: user._id,
              saleType: "auction",
            });
            const data = {
              TotalCollections721: collection721.length,
              TotalCollections1155: collection1155.length,
              TotalNFTs721: nftCreated721.length,
              TotalNFTs1155: nftCreated1155.length,
              TotalNFTsOnSale721: nftOnSale721.length,
              TotalNFTsOnSale1155: nftOnSale1155.length,
              TotalNFTsSoldFixedPrice: nftSoldFixedPrice.length,
              TotalNFTsSoldAuction: nftSoldAuction.length,
              TotalDropsFixedPrice: dropFixedPrice.length,
              TotalDropsAuction: dropAuction.length,
            };
            return res.status(200).json({
              success: true,
              data,
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
          "username email imageURL bannerURL bio walletAddress"
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
  .route("/admin/profile")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const userData = await UserModel.findById(req.user._id);

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
