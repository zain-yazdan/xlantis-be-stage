const {
  checkMissingAttributes,
  checkEmptyAttributes,
} = require("../../../utils/request-body");

const NftModel = require("../../../models/NFTModel");
const OrderListing = require("../../../models/OrderListingModel");
const TradeHistoryModel = require("../../../models/TradeHistory");
const { getNFTById } = require("../nft");

const getTxCostSummary = async (req, res) => {
  try {
    /* Code commented out as executeOrder will fails without approval so hardcoded values returned
        const drop = await DropModel.findById(req.params.dropId );
        if (!drop) {
            return res.status(400).json({
                success: false,
                message: "Drop not found against drop Id",
            });
        }

        const NFT = await NftModel
            .findById(req.params.nftId)
            .populate({
                path: 'collectionId',
                select: 'nftContractAddress contractType',
        });
        if (!NFT) {
            return res.status(400).json({
                success: false,
                message: "Drop Id is not added in NFT",
            });
        }

        const marketPlace = await OrderListing.findOne({
            dropId: req.params.dropId,
            nftId: req.params.nftId,
        });

        if (!marketPlace) {
            return res.status(400).json({
                success: false,
                message: "Drop is not put on sale yet",
            });
        }

        const user = await UserModel.findOne({
            email: req.user.email,
        });

        const estimate = await estimateBuy(
            user, 
            process.env.ERC1155_FIXED_PRICE_DROP_FACTORY_ADDRESS, 
            drop._id, 
            NFT, 
            marketPlace.price
        )
        if (!estimate.success) {
            return res.status(400).json({
                success: false,
                message: estimate.error,
            });
        }*/

    return res.status(200).json({
      success: true,
      data: {
        transactions: 2,
        data: [
          {
            transaction: "payment token approval",
            estimatedGas: 26149,
          },
          {
            transaction: "purchase fixed-price NFT",
            estimatedGas: 190464,
          },
        ],
      },
    });
  } catch (error) {
    console.log("error (try-catch) : " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};

const sellNFT = async (req, res) => {
  try {
    const requestBody = ["nftId", "price"];
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
    // const saleType = NftModel.schema.path('saleType').enumValues;
    // if (saleType.indexOf(req.body.saleType) == -1) {
    // 	return res.status(400).json({
    // 		success: false,
    // 		message:
    // 			'request body input for saleType field in is not defined in saleType enum for Drop Schema!',
    // 	});
    // }

    // const user = await UserModel.findOne({
    // 	email: req.user.email,
    // });

    // if (!user) {
    // 	return res.status(400).json({
    // 		success: false,
    // 		message: "user dont exist against this walletAddress",
    // 	});
    // }

    const nftResult = await getNFTById(req.body.nftId);
    if (!nftResult.success) {
      return res.status(400).json({
        success: false,
        message: nftResult.message,
      });
    }

    if (!nftResult.NFT.ownerId.equals(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "Only Owner can put NFT on sale.",
      });
    }
    if (nftResult.NFT.isOnSale) {
      return res.status(400).json({
        success: false,
        message: "This NFT is already on sale.",
      });
    }

    const marketplaceData = await OrderListing.create({
      userId: req.user._id,
      nftId: req.body.nftId,
      collectionId: nftResult.NFT.collectionId,
      price: req.body.price,
      saleType: "fixed-price",
    });
    const NFTreport = await nftResult.NFT.updateOne({
      isOnSale: true,
      currentOrderListingId: marketplaceData._id,
    });
    console.log({ NFTreport });
    return res.status(200).json({
      success: true,
      marketplaceData,
      message: "NFT successfully put on sale",
    });
  } catch (error) {
    console.log("catch-error : ", error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};

const buyNFT = async (req, res) => {
  try {
    const requestBody = ["nftId"];
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

    // const user = await UserModel.findOne({
    // 	email: req.user.email,
    // });

    // if (!user) {
    // 	return res.status(400).json({
    // 		success: false,
    // 		message: "user dont exist against this walletAddress",
    // 	});
    // }
    const nftResult = await getNFTById(req.body.nftId);
    if (!nftResult.success) {
      return res.status(400).json({
        success: false,
        message: nftResult.message,
      });
    }

    const marketplace = await OrderListing.findById(
      nftResult.NFT.currentOrderListingId
    );
    if (!marketplace) {
      return res.status(400).json({
        success: false,
        message: "Nft not found in marketplace.",
      });
    }
    if (nftResult.NFT.ownerId.equals(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "Owner can not buy his own NFT.",
      });
    }

    if (marketplace.saleType != "fixed-price") {
      return res.status(400).json({
        success: false,
        message: "Nft is not on fixed price sale.",
      });
    }

    // if (req.body.price != marketplace.price) {
    // 	return res.status(400).json({
    // 		success: false,
    // 		message: "Price is not the same as of nft price.",
    // 	});
    // }

    await TradeHistoryModel.create({
      nftId: req.body.nftId,
      sellerId: nftResult.NFT.ownerId,
      buyerId: req.user._id,
      soldAt: Date.now(),
      saleType: "fixed-price",
      unitPrice : marketplace.price
    });

    const NFTreport = await nftResult.NFT.updateOne({
      ownerId: req.user._id,
      isOnSale: false,
      currentOrderListingId: null,
    });
    console.log({ NFTreport });

    await marketplace.updateOne({
      isSold: true,
      soldAt: Date.now(),
    });
    return res.status(200).json({
      success: true,
      nftNewOwner: nftResult.NFT.ownerId,
      message: "NFT successfully bought",
    });
  } catch (error) {
    console.log("error (try-catch) : " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};

const getMyNFTs = async (req, res) => {
  try {
    const requestBody = ["saleType"];
    const missingAttribute = checkMissingAttributes(req.params, requestBody);
    if (missingAttribute != null) {
      return res.status(400).json({
        success: false,
        message: missingAttribute + " not found in request body!",
      });
    }
    const emptyAttributes = checkEmptyAttributes(req.params, requestBody);
    if (emptyAttributes != null) {
      return res.status(400).json({
        success: false,
        message: emptyAttributes + " was empty in request body!",
      });
    }

    const start = req.params.start;
    const end = req.params.end;

    if (start < 0) {
      return res.status(400).json({
        success: false,
        message: "starting index must be greater than or equal to 0",
      });
    }
    if (end <= 0) {
      return res.status(400).json({
        success: false,
        message: "ending index must be greater than 0",
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "ending index must be greater than starting index",
      });
    }

    if (start == end) {
      return res.status(400).json({
        success: false,
        message: "starting index and ending index must not be same",
      });
    }

    // const user = await UserModel.findOne({
    // 	email: req.user.email,
    // });

    // if (!user) {
    // 	return res.status(400).json({
    // 		success: false,
    // 		message: "user dont exist against this email",
    // 	});
    // }

    const marketplaceData = await OrderListing.find({
      userId: req.user._id,
      saleType: req.params.saleType,
      isSold: false,
    });

    let paginationResult = marketplaceData.slice(
      req.params.start,
      req.params.end
    );
    let ids = [];
    let data = [];
    for (let i = 0; i < paginationResult.length; i++) {
      ids.push(paginationResult[i].nftId);
      data.push({ price: paginationResult[i].price });
      if (req.params.saleType == "auction") {
        data[i]["startTime"] = paginationResult[i].startTime;
        data[i]["endTime"] = paginationResult[i].endTime;
      }
    }
    console.log("Ids : ", ids);
    const NFTs = await NftModel.find({ _id: { $in: ids } }).select(
      "title description nftURI"
    );

    for (let i = 0; i < paginationResult.length; i++) {
      data[i]["title"] = NFTs[i].title;
      data[i]["nftURI"] = NFTs[i].nftURI;
      data[i]["description"] = NFTs[i].description;
    }

    return res.status(200).json({
      success: true,
      NFTsInMarketplace: data,
    });
  } catch (error) {
    console.log("catch-error : ", error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};

const getNFTs = async (req, res) => {
  try {
    const requestBody = ["saleType", "start", "end"];
    const missingAttribute = checkMissingAttributes(req.params, requestBody);
    if (missingAttribute != null) {
      return res.status(400).json({
        success: false,
        message: missingAttribute + " not found in request params!",
      });
    }
    const emptyAttributes = checkEmptyAttributes(req.params, requestBody);
    if (emptyAttributes != null) {
      return res.status(400).json({
        success: false,
        message: emptyAttributes + " was empty in request params!",
      });
    }

    const start = req.params.start;
    const end = req.params.end;

    const checkPagination = validatePaginationParams(start, end);
    if (checkPagination.success == false) {
      return res.status(400).json({
        success: false,
        message: checkPagination.message,
      });
    }

    // const user = await UserModel.findOne({
    // 	email: req.user.email,
    // });

    // if (!user) {
    // 	return res.status(400).json({
    // 		success: false,
    // 		message: "user dont exist against this email",
    // 	});
    // }

    const marketplaceData = await OrderListing.find({
      saleType: req.params.saleType,
      isSold: false,
    });

    let paginationResult = marketplaceData.slice(start, end);
    let ids = [];
    let data = [];
    for (let i = 0; i < paginationResult.length; i++) {
      ids.push(paginationResult[i].nftId);
      data.push({ price: paginationResult[i].price });
      if (req.params.saleType == "auction") {
        data[i]["startTime"] = paginationResult[i].startTime;
        data[i]["endTime"] = paginationResult[i].endTime;
      }
    }
    console.log("Ids : ", ids);
    const NFTs = await NftModel.find({ _id: { $in: ids } }).select(
      "title description nftURI"
    );

    for (let i = 0; i < paginationResult.length; i++) {
      data[i]["title"] = NFTs[i].title;
      data[i]["nftURI"] = NFTs[i].nftURI;
      data[i]["description"] = NFTs[i].description;
    }

    return res.status(200).json({
      success: true,
      NFTsInMarketplace: data,
    });
  } catch (error) {
    console.log("catch-error : ", error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};

module.exports = { getTxCostSummary, sellNFT, buyNFT, getMyNFTs, getNFTs };
