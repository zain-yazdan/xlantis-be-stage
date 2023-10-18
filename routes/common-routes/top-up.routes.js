var express = require("express");
var router = express.Router();
const auth = require('../../middlewares/auth');
const passport = require('passport');
const stripe = require("stripe")(process.env.STRIPE_API_KEY);
const TopUpModel = require("../../models/TopUpModel");
const USDDepositModel = require("../../models/USDDepositRequestModel");
const { v4: uuidv4 } = require('uuid');

const web3Utils = require('../../blockchain/web3-utils');
const { convertMaticInUsd } = require("../../actions/crypto-convert");

const { checkEmptyAttributes, checkMissingAttributes } = require("../../utils/request-body");
const verifyUser = passport.authenticate('jwt', {
    session: false,
});

router
  .route("/")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin"),
    async (req, res) => {
      try {

        let amount = req.body.amount;
        if (amount == undefined) {
          return res.status(400).json({
            success: false,
            message: "Top-up amount not found in request body.",
          });
        }

        console.log("amount: ", amount);
        const MASTER_WALLET_ADDRESS = process.env.MASTER_WALLET_ADDRESS;
        const masterWalletBalance = await web3Utils.getWalletBalance(MASTER_WALLET_ADDRESS);
        const maticInUsd = await convertMaticInUsd(parseFloat(masterWalletBalance.inMatic));
        
        console.log("masterWalletBalance: ", masterWalletBalance);
        console.log("maticInUsd: ", maticInUsd);

        // 19 >= 19.95 - 1 = 18.95 (to be on safe side beacause of coin sending tx fee)
        if(parseInt(amount) >= (maticInUsd - 1)) {
          return res.status(200).json({
            success: false,
            errorType: "info",
            message: `Top-up facility is temporarily unavailable. Please try later.`,
          });
        }
        
        amount = parseInt(amount * 100);
        console.log("amount: ", amount);
        const stripeMinimumLimitInCents = parseInt(process.env.STRIPE_PROCESSING_MINIMUM_VALUE_IN_CENTS);
        if (amount <= stripeMinimumLimitInCents) {
          return res.status(400).json({
            success: false,
            message: `Top-up amount must be greater than ${stripeMinimumLimitInCents/100} usd.`,
          });
        }
        
        const stripeMaximumLimitInCents = parseInt(process.env.STRIPE_PROCESSING_MAXIMUM_VALUE_IN_CENTS);
        if (amount >= stripeMaximumLimitInCents) {
          return res.status(400).json({
            success: false,
            message: `Top-up amount must be less than ${stripeMaximumLimitInCents/100} usd.`,
          });
        }

  
        // if(amount <  500){
        //     return res.status(400).json({
        //         success: false,
        //         message:"Top-up amount must be greater thatn minimum top-up amount (5$)"
        //     })
        // }

        const idempotencyKey = uuidv4();
        const timeStep = process.env.STRIPE_SESSION_EXPIRY_STEP_IN_MINUTES;
        const now = new Date();
        let expiresAt = new Date(now.getTime() + timeStep * 60 * 1000);
        expiresAt = Math.floor(expiresAt / 1000)

        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: "Matic Top-up",
                },
                unit_amount: amount,
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `${process.env.STRIPE_SUCCESS_URL_ADMIN}?session_id={CHECKOUT_SESSION_ID}&active=true`,
          cancel_url: `${process.env.STRIPE_CANCEL_URL_ADMIN}?session_id={CHECKOUT_SESSION_ID}&active=false`,
          expires_at: expiresAt
          },{
            idempotencyKey,
          });
  
        const stripeInfo = {
          checkoutSessionId: session.id,
          topupRequesterUserId: req.user._id,
          idempotencyKey,
          paymentMode: 'admin-topup'
        }

        // Code commented out to disable toptup for user 
        // if (req.user.role == "user") stripeInfo["paymentMode"] = "user-topup"
        // else stripeInfo["paymentMode"] = "admin-topup"
        
        await USDDepositModel.create(stripeInfo);
  
        return res.status(200).json({
          checkoutSessionId:`${session.id}`,
          success: true,
          sessionUrl: `${session.url}`
        })
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
    .route("/user/history")
    .get(
        auth.verifyToken,
        verifyUser,
        auth.checkIsInRole("user", "admin"),
        async function (req, res, next) {
            try {
                let topupHistory = await TopUpModel.find({ userId: req.user._id });

                return res.status(200).json({
                    success: true,
                    topupHistory
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
    .route("/super-admin/history")
    .get(
        auth.verifyToken,
        verifyUser,
        auth.checkIsInRole("super-admin"),
        async function (req, res, next) {
            try {

                const topupHistory = await TopUpModel.find();

                return res.status(200).json({
                    success: true,
                    topupHistory: topupHistory
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

module.exports = router;
