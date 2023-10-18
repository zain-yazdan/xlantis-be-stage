var express = require("express");
const Web3 = require("web3");
const web3 = new Web3();
web3.setProvider(process.env.WEB_SOCKET);
var router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_API_KEY);
const OrderListingModel = require("../../models/OrderListingModel");
const NftModel = require("../../models/NFTModel");
const DropModel = require("../../models/DropModel");
const USDModel = require("../../models/USDDepositRequestModel");
const StripeEventsModel = require("../../models/StripeEventsModel");
const NotificationModel = require("../../models/NotificationModel");
const UserModel = require("../../models/UserModel");
const TradeHistoryModel = require("../../models/TradeHistory");
const NftOwnerModel = require("../../models/NFTOwnersData");
const TopUpModel = require("../../models/TopUpModel");

const { convertUSDInMatic } = require('../../actions/crypto-convert');
const { sendMaticTransferTx } = require('../../blockchain/master-wallet-utils');
const { sendTokenTransferTx } = require("../../blockchain/super-admin-utils");
const { ERC1155CollectableAbi } = require("../../blockchain/abi");
const auth = require("../../middlewares/auth");

const{ decrypt } = require("../../utils/encrypt-decrypt-key")

const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});

const { sendNotification } = require("../../utils/notification");
const { transferMatic, safeTransferFrom } = require("../utils/silent-wallet");

const { default: axios } = require("axios");
const collectionModel = require("../../models/CollectionModel");
const PlatformFeeRequests = require("../../models/PlatformFeeModel");
const Earnings = require("../../models/EarningsModel");

// const depositxUSD = async (depositAmount, userId, depositId) => {
//   try {
//     const endpoint = "https://polygon-api-dev.xmanna.com/deposit";
//     const amount = Web3.utils.toWei(depositAmount.toString(), "ether");
//     const body = {
//       amount,
//       currencyType: "usd",
//       userId,
//       eventType: "deposit",
//       depositId,
//     };
//     const config = {
//       headers: {
//         "User-Agent":
//           "LoyaltyApp/NFTMarket/1.0.0 (iOS Mozilla Firefox 99.0.4844.51 Ubuntu)",
//         Authorization: `Basic ${process.env.XMANNA_BASIC_AUTH_TOKEN}`,
//         "X-API-KEY": process.env.XMANNA_POLYGON_API_KEY,
//       },
//     };
//     const deposit = await axios.post(endpoint, body, config);
//     console.log("deposit: ", deposit.data);
//     return { status: true };
//   } catch (err) {
//     console.log("failure: ", err);
//     return { status: false, error: err.message };
//   }
// };

// const burnxUSD = async (withdrawAmount, userId, withdrawId) => {
//   try {
//     console.log("Withdraw and Burn Request requested")
//     const config = {
//       headers: {
//         "User-Agent":
//           "LoyaltyApp/NFTMarket/1.0.0 (iOS Mozilla Firefox 99.0.4844.51 Ubuntu)",
//         Authorization: `Basic ${process.env.XMANNA_BASIC_AUTH_TOKEN}`,
//         "X-API-KEY": process.env.XMANNA_POLYGON_API_KEY,
//       },
//     };
//     const endpoint = "https://polygon-api-dev.xmanna.com/withdraw/burn";
//     const body = {
//       amount: (withdrawAmount * 10 ** 2).toString(),
//       userId,
//       withdrawId,
//       currencyType: 'usd'
//     };
//     const withdraw = await axios.post(endpoint, body, config);

//     console.log("Withdraw and Burn Request done", withdraw.data)
//     return { status: true };
//   } catch (err) {
//     console.log("failure: ", err);
//     return { status: false, error: err.message };
//   }
// };

const getStripeAccountLink = async (user) => {
  try {
    if (!user.stripeAccountId) {
      console.log('create stripe account')
      var account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
      });
      user.stripeAccountId = account.id
      await user.save();
    } else {
      console.log('get account');
      account = await stripe.accounts.retrieve(user.stripeAccountId);          
    }
    
    const { details_submitted } = account;
    const accountLink = await stripe.accountLinks.create({
      account: user.stripeAccountId,
      refresh_url: process.env.STRIPE_ONBOARDING_REFRESH_URL,
      return_url: process.env.STRIPE_ONBOARDING_RETURN_URL,
      type: 'account_onboarding',
    });
  
    return { 
      success: true, 
      detailsSubmitted: details_submitted,
      onboardingLink: accountLink,
    } 
  } catch (err) {
    console.log("failure: ", err);
    return { success: false, error: err.message };
  }
}

router.route('/account/login').get(
  auth.verifyToken,
  verifyUser,
  auth.checkIsInRole("super-admin", "admin"),
  async function (req, res) {
    try{
      const user = await UserModel.findById(req.user._id)
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        })
      }

      if (!user.stripeAccountId) {
        return res.status(404).json({
          success: false,
          message: 'Stripe connected account not present for user'
        })
      }

      const link = await stripe.accounts.createLoginLink(user.stripeAccountId)

      return res.status(200).json({
        success: true,
        link: link.url 
      })
    } catch (err) {
      console.log('Error: ', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
})

router.route('/account/onboarding-link').get(
  auth.verifyToken,
  verifyUser,
  auth.checkIsInRole("super-admin", "admin"),
  async function (req, res) {
    try{
      const user = await UserModel.findById(req.user._id)
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        })
      }
      
      const response = await getStripeAccountLink(user);
      console.log({response});
      return res.status(200).json(response)
    } catch (err) {
      console.log('Error: ', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
})

router.route('/account/status').get(
  auth.verifyToken,
  verifyUser,
  auth.checkIsInRole("super-admin", "admin"),
  async function (req, res) {
    try{
      const user = await UserModel.findById(req.user._id)
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        })
      }

      let isAccountCreated = true, detailsSubmitted = false;
      if (!user.stripeAccountId) isAccountCreated = false

      if (isAccountCreated) {
        const account = await stripe.accounts.retrieve(user.stripeAccountId);
        const { details_submitted } = account;
        detailsSubmitted = details_submitted;
      }

      return res.status(200).json({
        success: true,
        isAccountCreated,
        detailsSubmitted
      })
    } catch (err) {
      console.log('Error: ', err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
})

async function saveEventToDatabase(event) {
  try {
    console.log(`Processing stripe ${event.type} event`)
    await StripeEventsModel.create({
      name: event.type,
      event,
    });
  } catch (error) {
    console.log('Error saving event to database: ' + error.message);
  }
}
function createWebhookError(errorMessage, statusCode) {
  return {
    success: false,
    message: errorMessage,
    statusCode: statusCode,
  };
}
async function updateStripeErrorMessage(stripeData, errorMessage) {
  console.log('error message: ', errorMessage)
  await stripeData.updateOne({ errorMessage });
}

async function handleCheckoutSessionCompleted(event) {
  console.log('Validation stripe data from database')
  const checkoutSessionId = event.data.object.id;
  const stripeData = await USDModel.findOne({ checkoutSessionId });

  if (!stripeData) return createWebhookError('Stripe data not found in the database, errant webhook', 404);

  if (stripeData.isExecuted) return createWebhookError('Duplicate request with the same session', 400);
  
  await stripeData.updateOne({ isExecuted: true });

  if (stripeData.paymentMode === 'admin-topup') {
    console.log('Processing topup request')
    return await handleTopUpRequest(stripeData, event);
  } else {
    console.log('Processing nft-purchase request')
    return await handleNftPurchase(stripeData, event);
  }
}
async function handleTopUpRequest(stripeData, event) {
  const user = await UserModel.findById(stripeData.topupRequesterUserId);

  const depositAmount = event.data.object.amount_total / 100;

  const topup = { 
    userId: user._id, 
    amountInUSD: depositAmount 
  }

  let matic = await convertUSDInMatic(depositAmount);
  topup["amountInMatic"] = matic;
  const amount = web3.utils.toWei(matic.toString(), "ether");

  const txData = {
    toAddress: user.walletAddress, 
    amountInWei: amount
  }

  console.log('Transfering matic tokens...')
  const isTransfered = await sendMaticTransferTx(txData, user._id);
  let isTransferedNotification = new NotificationModel({
    userId: stripeData.topupRequesterUserId,
  });
  if (!isTransfered.success) {
    await stripeData.updateOne({
      errorMessage: `Matic transfer to wallet failure: ${isTransfered.message}`,
    });
    isTransferedNotification.message = `Top-up (MATIC deposit) transaction failed`;
    isTransferedNotification = await NotificationModel.create(
      isTransferedNotification
    );
    sendNotification(isTransferedNotification.message);
    const error = `Matic transfer to wallet failure: ${isTransfered.message}`
    updateStripeErrorMessage(stripeData, error);
    return createWebhookError(error, 400);
  }
  console.log(`${matic} MATIC successfully transfered to your wallet`)
  isTransferedNotification.message = `${matic} MATIC successfully transfered to your wallet`;
  isTransferedNotification = await NotificationModel.create(
    isTransferedNotification
  );
  sendNotification(isTransferedNotification.message);

  await TopUpModel.create(topup)
  console.log('Topup complete...')
  return {
    success: true,
    message: 'Topup complete',
    statusCode: 200,
  }
}
async function handleNftPurchase(stripeData, event) {
  console.log('Retrieving resources from database...')
  const marketPlace = await OrderListingModel.findOne({
    nftId: stripeData.nftId,
  });
  if (!marketPlace) {
    const error = "Orderlisting not found in database";
    updateStripeErrorMessage(stripeData, error)
    return createWebhookError(error, 404);
  }

  const NFT = await NftModel.findById(stripeData.nftId);
  if (!NFT) {
    const error = "NFT not found in database";
    updateStripeErrorMessage(stripeData, error)
    return createWebhookError(error, 404);
  }

  const drop = await DropModel.findById(NFT.dropId);
  if (!drop) {
    const error = "Drop not found in database";
    updateStripeErrorMessage(stripeData, error)
    return createWebhookError(error, 404);
  }

  const buyer = await UserModel.findById(stripeData.buyerId);
  if (!buyer) {
    const error = "User(buyer) not found in database"
    updateStripeErrorMessage(stripeData, error)
    return createWebhookError(error, 404);
  }

  const seller = await UserModel.findById(stripeData.ownerId);
  if (!seller) {
    const error = "User(seller) not found in database"
    updateStripeErrorMessage(stripeData, error)
    return createWebhookError(error, 404);
  }

  const minter = await UserModel.findById(NFT.minterId);
  if (!minter) {
    const error = "User(minter) not found in database"
    updateStripeErrorMessage(stripeData, error)
    return createWebhookError(error, 404);
  }
  
  const collection = await collectionModel.findById(NFT.collectionId);
  if (!collection) {
    const error = "Collection not found in database"
    updateStripeErrorMessage(stripeData, error)
    return createWebhookError(error, 404);
  }

  if (!collection.nftContractAddress) {
    const error = "Collection in not deployed to blockchain"
    updateStripeErrorMessage(stripeData, error)
    return createWebhookError(error, 400);
  }

  const { platformFee } = await PlatformFeeRequests.findOne({
    isAccepted: "accepted"
  }).select('-_id platformFee')
  if (!platformFee) {
    const error = "platform fee is not set at the moment"
    updateStripeErrorMessage(stripeData, error)
    return createWebhookError(error, 404);
  }
  
  const super_admin = await UserModel.findOne({
    walletAddress: process.env.SUPER_ADMIN_WALLET_ADDRESS,
    role: "super-admin",
  });

  console.log('Transfering NFT to buyer...')
  const CollectableContract = new web3.eth.Contract(
    ERC1155CollectableAbi,
    collection.nftContractAddress
  );

  const safeTransfer = await sendTokenTransferTx({
    fromAddress: super_admin.walletAddress,
    privateKey: decrypt(process.env.SUPER_ADMIN_PRIVATE_KEY), 
    contractAddress: collection.nftContractAddress,
    functionAbi: await CollectableContract.methods.safeTransferFrom(
      seller.walletAddress,
      buyer.walletAddress,
      NFT.nftId,
      stripeData.supply,
      "0x00"
    )
  })

  if (safeTransfer.success == false) {
    const error = `Safe transfer failed: ${safeTransfer.error}`
    updateStripeErrorMessage(stripeData, error)
    return createWebhookError(error, 400);
  }
  const charge = await StripeEventsModel.findOne({
    name: 'charge.succeeded',
    'event.data.object.payment_intent': event.data.object.payment_intent
  })
  if(!charge) {
    const error = `charge not found against payment intent ${event.data.object.payment_intent}`
    updateStripeErrorMessage(stripeData, error)
    return createWebhookError(error, 400);
  }
  console.log('Making stripe distribution calucaltions...')
  const chargeId = charge.event.data.object.id
  const country = charge.event.data.object.payment_method_details.card.country
  const roytaltyFee = collection.royaltyFee;
  const amount_total = event.data.object.amount_total;
  let rate = parseFloat(process.env.STRIPE_BASE_RATE);
  if (country != process.env.STRIPE_BASE_LOCATION) rate = rate + 0.015;
  const stripeFee = Math.floor(( rate * amount_total) + 30)
  const amount = amount_total - stripeFee;
  const platformFeeAmount = Math.floor(amount * (platformFee / 100)); 
  if (roytaltyFee == 0) roytaltyFee = 1
  const royaltyFeeAmount = Math.floor(amount * (roytaltyFee / 100));
  const sellerAmount = Math.floor(amount - platformFeeAmount - royaltyFeeAmount);
  console.log('Stripe automatic deduction: ', stripeFee)
  console.log('Calculated royalty fee: ', royaltyFeeAmount)
  console.log('Calculated seller fee: ', sellerAmount)
  console.log('Calculated platform fee: ', platformFeeAmount)

  console.log('Total funds distributed: ', sellerAmount + platformFeeAmount + royaltyFeeAmount + stripeFee);
  const transferData = [
    {
      amount: royaltyFeeAmount,
      currency: 'usd',
      destination: minter.stripeAccountId,
      source_transaction: chargeId,
    },
    {
      amount: sellerAmount,
      currency: 'usd',
      destination: seller.stripeAccountId,
      source_transaction: chargeId,
    },
    {
      amount: platformFeeAmount,
      currency: 'usd',
      destination: super_admin.stripeAccountId,
      source_transaction: chargeId,
    },
  ];

  console.log('Updating resources in database')
  const nftPreviousOwner = await NftOwnerModel.findOne({
    ownerId: stripeData.ownerId,
    nftId: stripeData.nftId
  });
  let remainingSupply = Number(nftPreviousOwner.supply) - Number(stripeData.supply);
  let remainingSupplyOnSale = Number(marketPlace.supply) - Number(stripeData.supply);
  await TradeHistoryModel.create({
    nftId: stripeData.nftId,
    sellerId: stripeData.ownerId,
    buyerId: stripeData.buyerId,
    soldAt: Date.now(),
    saleType: "fixed-price",
    unitPrice : marketPlace.price,
    supply: stripeData.supply
  });

  if(remainingSupplyOnSale === 0){
    const NFTreport = await NFT.updateOne({
      currentOrderListingId: marketPlace._id,
      dropId: null,
    });
    console.log('Nft updation count: ', NFTreport.modifiedCount);
    
    const dropReport = await drop.updateOne({
      $inc: { totalNFTsSold: 1 },
    });
    console.log('Drop updation count: ', dropReport.modifiedCount);

    const marketPlaceReport = await marketPlace.updateOne({
      isSold: true,
      soldAt: new Date(),
      $inc: { supplySold: stripeData.supply },
    });
    console.log('Marketplace updation count: ', marketPlaceReport.modifiedCount);
  }
  else{
    const marketPlaceReport = await marketPlace.updateOne({
      $inc: { supplySold: stripeData.supply },
    });
    console.log('Marketplace updation count: ', marketPlaceReport.modifiedCount);
  }

  const previousOwnerReport = await nftPreviousOwner.updateOne({
    supply: remainingSupply
  })
  console.log('NFT Owner updation count: ', previousOwnerReport.modifiedCount);
  console.log(`${stripeData.supply} supply deducted from nft owner`);

  const nftNewOwner = await NftOwnerModel.findOne({
    ownerId: stripeData.buyerId,
    nftId: stripeData.nftId,
  });

  if(nftNewOwner){
    let newSupply = Number(nftNewOwner.supply) + Number(stripeData.supply);
    await nftNewOwner.updateOne({
      supply: newSupply
    })
  } else{
    await NftOwnerModel.create({
      ownerId: stripeData.buyerId,
      nftId: stripeData.nftId,
      supply: stripeData.supply
    });
  }

  const notification = await NotificationModel.create({
    userId: stripeData.buyerId,
    message: "NFT successfully transferred to new user.",
  });
  sendNotification(notification);

  console.log('Processing stripe payments...')
  if (royaltyFeeAmount != 0 ) {
    const transfer1 = await stripe.transfers.create(transferData[0]);
    console.log(`stripe funds transfer created for minter successful... 
    transfer id: ${transfer1.id}, 
    amount: ${transfer1.amount}
    destination: ${transfer1.destination}`)
  }

  if (sellerAmount != 0) {
    const transfer2 = await stripe.transfers.create(transferData[1]);
    console.log(`stripe funds transfer created for owner successful...'
    transfer id: ${transfer2.id}, 
    amount: ${transfer2.amount}
    destination: ${transfer2.destination}`)
  }

  if (platformFeeAmount!= 0) {
    const transfer3 = await stripe.transfers.create(transferData[2]);
    console.log(`stripe funds transfer created for platform successful...
    transfer id: ${transfer3.id}, 
    amount: ${transfer3.amount}
    destination: ${transfer3.destination}`)
  }

  const platform = {
    userId: super_admin._id,
    nftId: stripeData.nftId,
    amount: platformFeeAmount,
    type: 'platform-fee'
  }
  const roytalty = {
    userId: minter._id,
    nftId: stripeData.nftId,
    amount: royaltyFeeAmount,
    type: 'royalty-fee',
  }
  const earnings = {
    userId: seller._id,
    nftId: stripeData.nftId,
    amount: sellerAmount,
    type: 'nft-sold',
  }

  await Earnings.create(platform);
  await Earnings.create(roytalty);
  await Earnings.create(earnings);
  console.log("Summary for earnings created...");
  console.log('NFT successfully sold')
  return {
    success: true,
    message: 'NFT successfully sold',
    statusCode: 200,
  }
}
async function handleCheckoutSessionExpired(event) {
  console.log('Validation stripe data from database')
  const sessionId = event.data.object.id;
  const stripeData = await USDModel.findOne({
    checkoutSessionId: sessionId,
  });

  if (!stripeData) return createWebhookError(`Checkout session ${sessionId} expired... stripe info not found... failed to revert supply`, 400);
  

  if (stripeData.paymentMode === 'nft-purchase') {
    await OrderListingModel.updateOne({ _id: stripeData.orderListingId }, {
      $inc: { supply: stripeData.supply },
    });
    console.log(`Checkout session ${sessionId} expired, supply reverted`);
    await stripeData.updateOne({
      status: 'expired',
      errorMessage: `Checkout session ${sessionId} expired, supply reverted`,
    });
  } else {
    console.log('Topup request expired');
    await stripeData.updateOne({
      status: 'expired',
      errorMessage: 'Topup request expired',
    });
  }
  return {
    success: true,
    message: `Checkout session ${sessionId} expired`,
    statusCode: 200,
  }
}

router.route("/webhook").post(
  async (req, res) => {
    try {
      const event = req.body;
  
      await saveEventToDatabase(event);

      let response = Object();
      if (event.type === 'checkout.session.completed') {
        response = await handleCheckoutSessionCompleted(event);
      } else if (event.type === 'checkout.session.expired') {
        response = await handleCheckoutSessionExpired(event);
      }
  
      return res.status(200).json(response);
    } catch (error) {
      console.log('Webhook Error: ',  error.message);
      const checkoutSessionId = req.body.data.object.id;
      const stripeData = await USDModel.findOne({ checkoutSessionId });
      if (stripeData) updateStripeErrorMessage(stripeData, error.message)
      return res.status(200).json(createWebhookError(error.message, 500));
    }
  });
  
// module.exports = router;
module.exports = { router, getStripeAccountLink };
