const NFTModel = require("../../models/NFTModel");

const getNFTById = async (nftId) => {
  try {
    const NFT = await NFTModel.findById(nftId);
    if (!NFT) {
      return {
        success: false,
        message: "NFT not found against provided id",
      };
    }

    return { success: true, NFT };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

const getNFTByIdWithAssociatedCollection = async (nftId, attributes) => {
  try {
    const NFT = await NFTModel.findById(nftId).populate({
      path: "collectionId",
      select: attributes,
    });
    if (!NFT) {
      return {
        success: false,
        message: "Drop Id is not added in NFT",
      };
    }

    return { success: true, NFT };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

const getNFTsById = async (nftId) => {
  try {
    const NFTs = await NFTModel.find({ _id: nftId });
    if (NFTs.length === 0) {
      return {
        success: false,
        message: "No NFT found against provided nftId",
      };
    }

    return { success: true, NFTs };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

const getNFTsByCollectionId = async (collectionId) => {
  try {
    const NFTs = await NFTModel.find({
      collectionId: collectionId,
    });
    if (NFTs.length === 0) {
      return {
        success: false,
        message: "No NFTs were found against provided Collection Id!",
      };
    }

    return { success: true, NFTs };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

module.exports = {
  getNFTById,
  getNFTsById,
  getNFTsByCollectionId,
  getNFTByIdWithAssociatedCollection,
};
