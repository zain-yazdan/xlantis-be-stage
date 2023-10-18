var express = require("express");
const { RelayClient } = require("defender-relay-client");
var router = express.Router();

const UserModel = require("../../models/UserModel");
const MarketplaceModel = require("../../models/MarketplaceModel");

// const VerifyEmail = require("../../models/v1-sso/VerifyEmailModel");
const bcrypt = require("bcrypt");
const { BCRYPT_SALT_ROUNDS } = require("../../config/bcrypt");
const jwtUtil = require("../../utils/jwt");
const {
  checkMissingAttributes,
  checkEmptyAttributes,
} = require("../../utils/request-body");

const axios = require("axios");

require("dotenv").config();
// const { sendVerifyEmailURL } = require("../../actions/verifyEmail");
const { generateUsername } = require("unique-username-generator");

const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const Cryptr = require("cryptr");
const cryptr = new Cryptr(process.env.CRYPTR_SECRET_KEY, { saltLength: 12 });

const Web3 = require("web3");
const web3 = new Web3();
web3.setProvider(process.env.WEB_SOCKET);

const config = {
  headers: {
    "User-Agent": "LoyaltyApp/NFTMarket/1.0.0 (iOS Mozilla Firefox 99.0.4844.51 Ubuntu)",
    Authorization: `Basic ${process.env.XMANNA_BASIC_AUTH_TOKEN}`,
    "X-API-KEY": process.env.XMANNA_POLYGON_API_KEY,
  },
};
const xmannaDevLogin = async (idToken) => {
  try {
    console.log("Attempting login to la-user-dev.xmanna...");
    const endpoint = process.env.XMANNA_SSO_API_URL;
    const body = {
      type: "google",
      authToken: idToken,
    }

    const response = await axios.post(endpoint, body, config);

    console.log("Login successful")
    return { success: true,  data: response.data.body};
  } catch (err) {
    console.log("failure: ", err.message);
    return { 
      success: false, 
      message: `failed to login to xmanna api`,
      error: err.message };
  }
};
const getXmannaUser = async (id) => {
  try {
    console.log(`Attempting to fetch xmanna user: ${id}`);
    const endpoint = `${process.env.POLYGON_API_URL}/account/${id}`;
    const response = await axios.get(endpoint, config);

    console.log("Xmanna user retrieved")
    return { success: true,  data: response.data.body };
  } catch (err) {
    console.log("failure: ", err.message);
    return { 
      success: false,
      message: `failed to get xmanna user: ${id}`,
      error: err.message };
  }
};

router.post("/user-login", async function (req, res, next) {
  try {
    let idToken = req.body.idToken;
    if (!idToken) {
      return res.status(401).send("google id token not found !!");
    }
    let ticket, payload;
    try {
      ticket = await client.verifyIdToken({
        idToken: idToken,
      });
      payload = ticket.getPayload();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "id token verification failure",
        error: err.message,
      });
    }
    // Login to LA dev api
    const xmannaLogin = await xmannaDevLogin(req.body.idToken);
    if (!xmannaLogin.success) return res.status(401).json(xmannaLogin)
    
    // Get the account logged in from polygon api
    const xmannaUser = await getXmannaUser(xmannaLogin.data.user._id);
    if (!xmannaUser.success) return res.status(401).json(xmannaUser)


    let user = await UserModel.findOne({
      email: payload.email,
    });
    if(user?.role == 'admin') {
      return res.status(200).json({
        success: false,
        message: 'Email registered for an admin account'
      });
    }

    // default case: admin is waiting for approval
    let response = {
      success: true,
    };

    // Case 01: admin is not present, create new admin and relayer
    if (!user) {
      user = new UserModel({
        email: payload.email,
        username: payload.name,
        role: "user",
        imageURL: payload.picture,
        walletAddress: xmannaUser.data.user.fiatWalletAddress,
        userType: "v1",
        xmannaUserId: xmannaLogin.data.user._id,
      });
      await UserModel.create(user);
      jwt = await jwtUtil.sign({
        email: user.email,
        role: user.role,
        userId: user._id,
        userType: user.userType,
        address: user.walletAddress
        // domain: req.body.domain,
      });
      response.raindropToken = jwt;

      response.message = "New admin created. Awaiting super-admin approval";
    }
    // Case 02: admin is present and is verified, get jwt and login
    else {
      if (user.role != "user") {
        return res.status(400).json({
          success: false,
          message: user.role + " cannot login in as user.",
        });
      }
      const payload = {
        email: user.email,
        role: user.role,
        userId: user._id,
        userType: user.userType,
        address: user.walletAddress
        // domain: req.body.domain,
      };

      if (user.isVerified) {
        response.raindropToken = await jwtUtil.sign(payload);
        response.message = "User successfully logged in";
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
    }
    response.walletAddress = user.walletAddress;
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
    let idToken = req.body.idToken;

    if (!idToken) {
      return res.status(401).send("google id token not found !!");
    }
    let ticket, payload;
    try {
      ticket = await client.verifyIdToken({
        idToken: idToken,
      });
      payload = ticket.getPayload();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "id token verification failure",
        error: err.message,
      });
    }
    // Login to LA dev api
    const xmannaLogin = await xmannaDevLogin(req.body.idToken);
    if (!xmannaLogin.success) return res.status(401).json(xmannaLogin)
    
    // Get the account logged in from polygon api
    const xmannaUser = await getXmannaUser(xmannaLogin.data.user._id);
    if (!xmannaUser.success) return res.status(401).json(xmannaUser)

    let user = await UserModel.findOne({
      email: payload.email,
    });
    if(user?.role == 'user') {
      return res.status(200).json({
        success: false,
        message: 'Email registered for a user account'
      });
    }
    // default case: admin is waiting for approval
    let response = {
      success: true,
    };

    // Case 01: admin is not present, create new admin and relayer
    if (!user) {
      user = new UserModel({
        email: payload.email,
        username: payload.name,
        role: "admin",
        imageURL: payload.picture,
        walletAddress: xmannaUser.data.user.fiatWalletAddress,
        userType: "v1",
        xmannaUserId: xmannaLogin.data.user._id,
      });
      await UserModel.create(user);
      jwt = await jwtUtil.sign({
        email: user.email,
        role: user.role,
        userId: user._id,
        userType: user.userType,
        address: user.walletAddress
      });
      response.raindropToken = jwt;

      response.message = "New admin created. Awaiting super-admin approval";
    }
    // Case 02: admin is present and is verified, get jwt and login
    else {
      if (user.role != "admin") {
        return res.status(400).json({
          success: false,
          message: user.role + " cannot login in as user.",
        });
      }

      if (user.isVerified && !user.isEnabled && user.isInfoAdded) {
        return res.status(200).json({
          isEnabled: user.isEnabled,
          isInfoAdded: user.isInfoAdded,
          isVerified: user.isVerified,
          success: false,
          message: "admin is disabled.",
        });
      }

      const marketplace = await MarketplaceModel.findOne({adminId: user._id});
      const payload = {
        email: user.email,
        role: user.role,
        userId: user._id,
        userType: user.userType,
        address: user.walletAddress
      };
      if (marketplace){
        payload["marketplaceId"] = marketplace._id;
        payload["domain"] = marketplace.domain;
      }
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
    }
    response.walletAddress = user.walletAddress;
    response.isInfoAdded = user.isInfoAdded;
    response.isVerified = user.isVerified;
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

router.post("/super-admin-login", async function (req, res, next) {
  try {
    const requestBody = ["email", "password"];
    const missingAttribute = checkMissingAttributes(req.body, requestBody);
    if (missingAttribute != null) {
      return res.status(400).json({
        success: false,
        message: missingAttribute + " not found in request body!",
      });
    }
    const emptyAttributes = checkEmptyAttributes(req.body, requestBody);
    if (emptyAttributes != null) {
      return res.status(400).json({
        success: false,
        message: emptyAttributes + " was empty in request body!",
      });
    }

    // if (req.body.email != process.env.SUPER_ADMIN_EMAIL) {
    // 	return res.status(401).json({
    // 		success: false,
    // 		message: "Unauthorized super admin.",
    // 	});
    // }

    let user = await UserModel.findOne({ email: req.body.email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Super admin not created.",
      });
    }

    let result = bcrypt.compareSync(req.body.password, user.password);

    if (!result) {
      return res.status(400).json({
        success: false,
        message: "Incorrect Password.",
      });
    }
    const token = await jwtUtil.sign({
      email: req.body.email,
      role: user.role,
      userId: user._id,
      address: user.walletAddress
    });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
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
