const UserModel = require("../../models/UserModel");

// For Eg
async function getUserById(userId) {
  const user = await UserModel.findOne({ _id: userId });
  if (user) {
    return { success: true, user: user };
  }
  return {
    success: false,
    error: `user not found against the userId: ${userId}`,
  };
}

async function getAdminByFilter(filter, isV1 = true, isVerified = true) {
  filter.role = "admin";
  filter.userType = isV1 === true ? "v1" : "v2";
  if (isVerified !== "omit") {
    filter.isVerified = isVerified === true ? true : false;
  }
  // filter.isInfoAdded = true;
  const user = await UserModel.find(filter);
  if (user) {
    return { success: true, admins: user };
  }
  return { success: false, error: `admin not found` };
}

async function getAdminCount(filter, isV1 = true, /*isVerified = true*/) {
  filter.role = "admin";
  filter.userType = isV1 === true ? "v1" : "v2";
  // filter.isVerified = isVerified === true ? true : false;
  console.log("Filter : ", filter)
  return await UserModel.countDocuments(filter);
}

async function getUserByDomain(domain) {
  try {
    const user = await UserModel.findOne({ domain: domain });
    if (user) {
      return { success: true, user };
    }
    return {
      success: false,
      error: `user not found against the domain: ${domain}`,
    };
  } catch (error) {
    return { success: false, error };
  }
}
module.exports = {
  getUserById,
  getAdminCount,
  getAdminByFilter,
  getUserByDomain,
};
