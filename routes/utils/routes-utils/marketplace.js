const MarketplaceModel = require("../../../models/MarketplaceModel");

async function getMarketplace(id) {
  if (id == undefined) {
    return {
      success: false,
      message: "marketplaceId not found in request",
    };
  }
  if (id == "") {
    return{
      success: false,
      message: "marketplaceId found empty in request",
    };
  }

  const marketplace = await MarketplaceModel.findById(id);
  if (!marketplace) {
    return {
      success: false,
      message: "Marketplace not registered",
    };
  }

  return {
    success: true, 
    marketplace
  };
}

module.exports.getMarketplace = getMarketplace;
