const bcrypt = require("bcrypt");
const { BCRYPT_SALT_ROUNDS } = require("../config/bcrypt");
const PlatformFeeRequests = require("../models/PlatformFeeModel");
const UserModel = require("../models/UserModel");

module.exports.superAdminInit = async (walletAddress) => {
  try {
    let super_admin = await UserModel.findOne({
      role: "super-admin",
      walletAddress: process.env.SUPER_ADMIN_WALLET_ADDRESS,
      email: process.env.SUPER_ADMIN_EMAIL,
    });

    if (!super_admin) {
      let password = process.env.SUPER_ADMIN_PASSWORD;
      password = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      super_admin = await UserModel.create({
        walletAddress: process.env.SUPER_ADMIN_WALLET_ADDRESS,
        role: "super-admin",
        userType: 'v1',
        username: 'Xmanna',
        earnings: 0,
        email: process.env.SUPER_ADMIN_EMAIL,
        password,
        stripeAccountId: process.env.SUPER_ADMIN_STRIPE_ID
      });
      console.log("Super admin instantiated for v1");
    }

    let platform_fee = await PlatformFeeRequests.findOne({
      userId: super_admin._id,
      isAccepted: "accepted"
    });

    if (!platform_fee) {
      await PlatformFeeRequests.create({
        userId: super_admin._id,
        platformFee: process.env.DEFAULT_PLATFORM_FEE_PERCENTAGE,
        isAccepted: "accepted"
      })
      console.log("Default platform fee percentage set for v1");
    }

  } catch (err) {
    console.error(err);
  }
};
