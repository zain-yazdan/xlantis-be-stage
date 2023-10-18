var express = require("express");
var router = express.Router();

const UserModel = require("../models/UserModel");
const jwtUtil = require("../utils/jwt");
const {
  checkMissingAttributes,
  checkEmptyAttributes,
} = require("../utils/requestBody");

require("dotenv").config();
const { generateUsername } = require("unique-username-generator");
const Web3 = require("web3");
const web3 = new Web3();

router.post("/login", async function (req, res, next) {
  try {
    const requiredParameters = ["walletAddress", "signature"];
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

    const filter = { walletAddress: req.body.walletAddress };
    let user = await UserModel.findOne(filter);

    let token;
    const response = {
      success: true,
      message: "User logged in",
    };
    if (user) {
      if (
        user.role == "super-admin" &&
        req.body.walletAddress != process.env.SUPER_ADMIN_WALLET_ADDRESS
      ) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized super admin.",
        });
      }

      token = await jwtUtil.sign({
        walletAddress: req.body.walletAddress,
        role: user.role,
        userId: user._id,
      });

      response.raindropToken = token;
      return res.status(200).json(response);
    }
    let username = generateUsername("-", 2);

    user = await UserModel.create({
      walletAddress: req.body.walletAddress,
      role: "user",
      username,
    });

    token = await jwtUtil.sign({
      walletAddress: req.body.walletAddress,
      role: user.role,
      userId: user._id,
    });

    response.message = "User created and logged in";
    response.raindropToken = token;

    return res.status(200).json(response);
  } catch (error) {
    console.log("error (try-catch) : " + error);
    return res.status(500).json({
      success: false,
      message: "User wallet address was empty in the request body",
    });
  }
});

router.post("/admin-login", async function (req, res, next) {
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

    let webToken = null;
    let user = await UserModel.findOne({
      walletAddress: req.body.walletAddress,
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "contact Super Admin to add you as an admin.",
      });
    } else {
      if (user.role != "admin") {
        return res.status(400).json({
          success: false,
          message: "User cannot login as admin.",
        });
      }
      const payload = {
        walletAddress: user.walletAddress,
        role: user.role,
        userId: user._id,
      };
      webToken = await jwtUtil.sign(payload);
    }

    if (user.isVerified == false || user.isEnabled == false) {
      return res.status(200).json({
        success: true,
        message:
          "Admin successfully logged in, profile information required to access website features...",
        walletAddress: user.walletAddress,
        role: user.role,
        userId: user._id,
        raindropToken: webToken,
        isVerified: user.isVerified,
        isEnabled: user.isEnabled,
        isInfoAdded: user.isInfoAdded,
      });
    } else {
      return res.status(200).json({
        success: true,
        message:
          "Admin successfully logged in, profile information also verified, Now you can access all website features...",
        walletAddress: user.walletAddress,
        role: user.role,
        userId: user._id,
        raindropToken: webToken,
        isVerified: user.isVerified,
        isEnabled: user.isEnabled,
        isInfoAdded: user.isInfoAdded,
      });
    }
  } catch (error) {
    console.log("error (try-catch) : " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
});

router.post("/super-admin-login", async function (req, res, next) {
  try {
    if (req.body.walletAddress == undefined) {
      return res.status(400).json({
        success: false,
        message: "Super admin wallet address not found in request body.",
      });
    }
    if (req.body.walletAddress == "") {
      return res.status(400).json({
        success: false,
        message: "Super admin wallet address found empty in request body.",
      });
    }
    if (!web3.utils.isAddress(req.body.walletAddress)) {
      return res.status(400).json({
        success: false,
        message: "It is not a valid wallet address.",
      });
    }

    if (
      req.body.walletAddress.toUpperCase() !==
      process.env.SUPER_ADMIN_WALLET_ADDRESS.toUpperCase()
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet address for super admin.",
      });
    }

    let user = await UserModel.findOne({
      walletAddress: req.body.walletAddress,
    });

    let response = {
      success: true,
      message: "Super Admin signup successfully.",
    };

    if (user) {
      if (user.role != "super-admin") {
        return res.status(400).json({
          success: false,
          message: "User cannot login as super-admin.",
        });
      }
      response.message = "Super Admin login successfully.";
    } else {
      user = await UserModel.create({
        walletAddress: req.body.walletAddress,
        role: "super-admin",
        username: "Super Admin",
        isVerified: true,
        isEnabled: true,
      });
    }

    let token = await jwtUtil.sign({
      walletAddress: req.body.walletAddress,
      role: user.role,
      userId: user._id,
    });
    response.raindropToken = token;
    return res.status(200).json(response);
  } catch (error) {
    console.log("error (try-catch) : " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
});

module.exports = router;
