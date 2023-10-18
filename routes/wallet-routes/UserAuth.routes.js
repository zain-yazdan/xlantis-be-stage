var express = require("express");
var router = express.Router();

const UserModel = require("../../models/UserModel");
// const VerifyEmail = require("../../models/v2-wallet-login/VerifyEmailModel");
const bcrypt = require("bcrypt");
const { BCRYPT_SALT_ROUNDS } = require("../../config/bcrypt");
const jwtUtil = require("../../utils/jwt");
const {
  checkMissingAttributes,
  checkEmptyAttributes,
} = require("../../utils/request-body");

require("dotenv").config();
const { sendVerifyEmailURL } = require("../../actions/verifyEmail");
const { generateUsername } = require("unique-username-generator");
const Web3 = require("web3");
const web3 = new Web3();
// router.post("/signup", async function (req, res, next) {
//   try {
//     const requiredAttributes = ['email', 'password'];

//     const missingParam = checkMissingAttributes(req.body, requiredAttributes);
//     if (missingParam != null) {
//       return res.status(400).json({
//         success: false,
//         message: missingParam + " not found in request body!",
//       });
//     }

//     const emptyParam = checkEmptyAttributes(req.body, requiredAttributes);
//     if (emptyParam != null) {
//       return res.status(400).json({
//         success: false,
//         message: emptyParam + " was empty in request body!",
//       });
//     }

//     if (req.body.password.length < 4) {
//       return res.status(400).json({
//         success: false,
//         message: "Password length must be greater than 4!",
//       });
//     }

//     var emailCheck = await UserModel.findOne({ email: req.body.email });
//     if (emailCheck) {
//       return res.status(409).json({
//         success: false,
//         message: "This Email already exists, choose another one.",
//       });
//     }

//     const hashedPassword = await bcrypt.hash(
//       req.body.password,
//       BCRYPT_SALT_ROUNDS
//     );

//     req.body.password = hashedPassword;

//     var newUser = new UserModel({
//       email: req.body.email,
//       username: generateUsername('-', 2),
//       password: req.body.password,
//       role: "user",
//     });

//     await UserModel.create(newUser);
//     console.log("new user created");

//     let CLIENT_NAME;

//     if (process.env.NODE_MODE === "deployed") {
//       CLIENT_NAME = req.headers.origin;
//     } else {
//       CLIENT_NAME = "http://localhost:3000";
//     }

//     let mailSent = await sendVerifyEmailURL(CLIENT_NAME, req.body.email);

//     if (!mailSent)
//       return res.send(
//         "User Registered Successfully. Unable to send verification email."
//       );
//     res.send("User Registered Successfully. Kindly verify your Email.");
//   } catch (error) {
//     console.log("error (try-catch) : " + error);
//     return res.status(500).json({
//       success: false,
//       err: error,
//     });
//   }
// });
router.post("/login", async function (req, res, next) {
  try {
    const requiredParameters = ["walletAddress", "signature", "domain"];
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

    const emptyAttributes = checkEmptyAttributes(req.body, requiredParameters);
    if (emptyAttributes != null) {
      return res.status(400).json({
        success: false,
        message: emptyAttributes + " was empty in request body",
      });
    }

    const rawMessage = `Welcome to RobotDrop! \n\nClick to sign in and accept the RobotDrop Terms of Service: https://RobotDrop.io/tos \n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nYour authentication status will reset after 24 hours. \n\nWallet address: ${req.body.walletAddress}`;
    const retrivedAddress = web3.eth.accounts.recover(
      rawMessage,
      req.body.signature
    );

    console.log("retrived_address: ", retrivedAddress);
    if (req.body.walletAddress != retrivedAddress) {
      return res.status(401).json({
        success: false,
        message:
          "Unauthorized access: wallet address and pink slip signatory do not match",
      });
    }

    let user = await UserModel.findOne({
      walletAddress: req.body.walletAddress,
    });

    let token;
    const response = {
      success: true,
      // message: "User logged in",
    };
    if (!user) {
      // if (user.role == "super-admin" && req.body.walletAddress != process.env.SUPER_ADMIN_WALLET_ADDRESS) {
      // 	return res.status(401).json({
      // 		success: false,
      // 		message: "Unauthorized super admin.",
      // 	});
      // }
      
      let username = generateUsername("-", 2);

      user = await UserModel.create({
        walletAddress: req.body.walletAddress,
        role: "user",
        username,
        userType: "v2"
      });

      token = await jwtUtil.sign({
        walletAddress: req.body.walletAddress,
        role: user.role,
        userId: user._id,
        userType: user.userType,
        domain: req.body.domain,
      });

      response.raindropToken = token;
      response.message = "New user created. Awaiting for super-admin approval";
      // return res.status(200).json(response);
    } else {
      if (user.role == "admin") {
        return res.status(400).json({
          success: false,
          message: "Admin cannot login in as user.",
        });
      }
      token = await jwtUtil.sign({
        walletAddress: req.body.walletAddress,
        role: user.role,
        userId: user._id,
        domain: req.body.domain,
      });

      if (user.isVerified) {
        response.raindropToken = token;
        response.message = "User successfully logged in.";
        console.log("case 1");
      } else {
        if (user.isInfoAdded) {
          response.message =
            "Your request is under process. Waiting for approval by super-admin.";
          console.log("case 2");
        } else {
          response.raindropToken = token;
          response.message =
            "User successfully logged in, account details required.";
          console.log("case 3");
        }
      }
    }

    response.isInfoAdded = user.isInfoAdded;
    response.isVerified = user.isVerified;
    return res.status(200).json(response);
  } catch (error) {
    console.log("error (try-catch) : " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
});

router.post("/admin-login", async function (req, res, next) {
  try {
    if (req.body.walletAddress == undefined) {
      return res.status(400).json({
        success: false,
        message: "New admin wallet address not found in request body.",
      });
    }
    if (req.body.walletAddress == "") {
      return res.status(400).json({
        success: false,
        message: "New admin wallet address found empty in request body.",
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
    let response = {
      success: true,
      // message: "Admin signup successfully."
    };

    if (!user) {
      let username = generateUsername("-", 2);
      user = await UserModel.create({
        walletAddress: req.body.walletAddress,
        role: "admin",
        username,
        userType: "v2",
      });
      let token = await jwtUtil.sign({
        walletAddress: req.body.walletAddress,
        role: user.role,
        userId: user._id,
        userType: user.userType,
      });
      response.raindropToken = token;
      response.message = "New admin created. Awaiting super-admin approval";
    } else {
      if (user.role != "admin") {
        return res.status(400).json({
          success: false,
          message: user.role + " cannot login as admin.",
        });
      }
      const payload = {
        walletAddress: user.walletAddress,
        role: user.role,
        userId: user._id,
        userType: user.userType,
      };
      if (user.isVerified) {
        response.raindropToken = await jwtUtil.sign(payload);
        response.message = "Admin successfully logged in";
        console.log("case 1");
      } else {
        if (user.isInfoAdded) {
          response.message =
            "Your request is under process. Waiting for approval by super-admin";
          console.log("case 2");
        } else {
          response.raindropToken = await jwtUtil.sign(payload);
          response.message =
            "Admin successfully logged in, account details required";
          console.log("case 3");
        }
      }
      // response.message = "Admin login successfully."
    }
    response.walletAddress = user.walletAddress;
    response.isInfoAdded = user.isInfoAdded;
    response.isVerified = user.isVerified;
    response.role = user.role;
    response.userId = user._id;
    response.isEnabled = user.isEnabled;

    return res.status(200).json(response);
  } catch (error) {
    console.log("error (try-catch) : " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
});

// router.post("/super-admin-login", async function (req, res, next) {
// 	try {
// 			if (req.body.walletAddress == undefined){
// 				return res.status(400).json({
// 					success: false,
// 					message: "Super admin wallet address not found in request body.",
// 				});
// 			}
// 			if (req.body.walletAddress == ""){
// 				return res.status(400).json({
// 					success: false,
// 					message: "Super admin wallet address found empty in request body.",
// 				});
// 			}
// 			if(!web3.utils.isAddress(req.body.walletAddress)){
// 				return res.status(400).json({
// 				success: false,
// 				message:"It is not a valid wallet address."
// 				})
//       		}

// 			if(req.body.walletAddress.toUpperCase() !== process.env.SUPER_ADMIN_WALLET_ADDRESS.toUpperCase()){
// 				return res.status(400).json({
// 					success: false,
// 					message:"Invalid wallet address for super admin."
// 				})
// 			}

// 			let user = await UserModel.findOne({walletAddress: req.body.walletAddress});

// 			let response = {
// 				success: true,
// 				message: "Super Admin signup successfully."
// 			}

// 			if (user) {
// 				if(user.role != "super-admin"){
// 				return res.status(400).json({
// 					success: false,
// 					message: "User cannot login as super-admin."
// 				})
// 				}
// 				response.message = "Super Admin login successfully."
// 			}
//       		else{
// 				user = await UserModel.create({
// 				  	walletAddress: req.body.walletAddress,
// 				  	role: "super-admin",
//           			username:"Super Admin"
// 			  	})
//       		}

// 			let token = await jwtUtil.sign({
// 				walletAddress: req.body.walletAddress,
// 				role: user.role,
// 				userId: user._id,
// 			});
//         	response.raindropToken = token;
// 		return res.status(200).json(response);
// 		} catch (error) {
// 		console.log("error (try-catch) : " + error);
// 		return res.status(500).json({
// 			success: false,
// 			err: error,
// 		});
// 	}
// });

module.exports = router;
