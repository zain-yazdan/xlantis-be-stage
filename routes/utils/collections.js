const CollectionModel = require("../../models/CollectionModel");

const getCollectionById = async (collectionId) => {
  try {
    const collection = await CollectionModel.findById(collectionId);
    if (!collection) {
      return {
        success: false,
        message: "Collection not found against provided Collection Id",
      };
    }
    return { success: true, collection };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

module.exports = {
  getCollectionById,
};
