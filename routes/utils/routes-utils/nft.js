require("dotenv").config();

const { generateUint256Id } = require("../../../utils/blockchain");

const UserModel = require("../../../models/UserModel");
const NftModel = require("../../../models/NFTModel");
const NftOwnersModel = require("../../../models/NFTOwnersData");

const { checkMissingAttributes,
	checkEmptyAttributes,
	constructObject,
	validatePaginationParams,
	validateTxHash} = require("../../../utils/request-body");
const { getUserByDomain } = require("../users");
const { getCollectionById } = require("../collections");
const { getNFTsById, getNFTsByCollectionId, getNFTById } = require("../nft");
const { getMarketplace } = require("./marketplace");

const getMyNFTs = async (req, res) => {
  try {
    const start = req.params.start;
    const end = req.params.end;

    const requiredAttributes = ["start", "end"];
    const missingAttribute = checkMissingAttributes(
      req.params,
      requiredAttributes
    );

    if (missingAttribute != null) {
      return res.status(400).json({
        success: false,
        message: `${missingAttribute} not found in request params!`,
      });
    }

    const emptyAttributes = checkEmptyAttributes(
      req.params,
      requiredAttributes
    );
    if (emptyAttributes != null) {
      return res.status(400).json({
        success: false,
        message: `${emptyAttributes} was empty in request params!`,
      });
    }

    const checkPagination = validatePaginationParams(start, end);
    if (checkPagination.success == false) {
      return res.status(400).json({
        success: false,
        message: checkPagination.message,
      });
    }

    // const marketplace = await getMarketplace(req.query.marketplaceId)
    // if (!marketplace.success) {
    //   return res.status(400).json(marketplace)
    // }

    // var finalNftResult = [];
    let ownersData = await NftOwnersModel.find({ownerId: req.user._id});
    let nftIds = ownersData.map(data => data.nftId);
    console.log("NFT ids : ", nftIds);

    let nftResult = await NftModel.find({
      _id: {
        $in: nftIds,
      },
      // marketplaceId: req.query.marketplaceId
    });
    // console.log("Nftresult = ", nftResult);

    let nftResultReverse = nftResult.reverse();

    // for (var i = 0; i < nftResultReverse.length; i++) {
    // 	if (nftResultReverse[i].tokenSupply > 0) {
    // 		finalNftResult.push(nftResultReverse[i]);
    // 	}
    // }

    var paginationResult = nftResultReverse.slice(start, end);
    paginationResult = JSON.stringify(paginationResult)
    paginationResult = JSON.parse(paginationResult)

    let data;
    for(let i = 0; i< paginationResult.length; i++){
      data = ownersData.find(data => data.nftId.equals(paginationResult[i]._id)); 
      paginationResult[i].supply = data.supply;

      // console.log("Supply: ",paginationResult[i].supply);
    }
    // console.log("Paginated result: ",paginationResult)
    
    return res.status(200).json({
      success: true,
      NFTdata: paginationResult,
      // Nftcount: finalNftResult.length,
    });
  } catch (error) {
    console.log("error (try-catch) : " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};

const getMyNFTsOnSale = async (req, res) => {
  try {

    let user = await UserModel.findById(req.user._id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    const marketplace = await getMarketplace(req.query.marketplaceId)
    if (!marketplace.success) {
      return res.status(400).json(marketplace)
    }

    let ownersData = await NftOwnersModel.find({ownerId: req.user._id});
    let nftIds = ownersData.map(data => data.nftId);
    console.log("NFT ids : ", nftIds);

    const NFTs = await NftModel.find({
      _id: {$in : nftIds},
      isOnSale: req.params.onSale,
      marketplaceId: req.query.marketplaceId
    }).select("_id title nftURI description");

    return res.status(200).json({
      success: true,
      NFTs: NFTs,
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
    let user = await UserModel.findById(req.user._id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    const marketplace = await getMarketplace(req.query.marketplaceId)
    if (!marketplace.success) {
      return res.status(400).json(marketplace)
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

    var finalNftResult = [];
    
    let ownersData = await NftOwnersModel.find({ownerId: req.user._id});
    let nftIds = ownersData.map(data => data.nftId);
    console.log("NFT ids : ", nftIds);

    var nftResult = await NftModel.find({ _id: {$in:nftIds } }, marketplaceId, req.query.marketplaceId);
    console.log("Nftresult = ", nftResult);

    var nftResultReverse = nftResult.reverse();

    var paginationResult = nftResultReverse.slice(start, end);

		return res.status(200).json({
			success: true,
			NFTdata: paginationResult,
		});
	} catch (error) {
		console.log("error (try-catch) : " + error);
		return res.status(500).json({
			success: false,
			err: error,
		});
	}
};

const getRarities = async (req, res) => {
	try {
		let rarities = NftModel.schema
			.path("rarity").enumValues;
		return res.status(200).json({
			success: true,
			Rarities: rarities,
		});
	} catch (error) {
		console.log("error (try-catch) : " + error);
		return res.status(500).json({
			success: false,
			err: error,
		});
	}
};

const getNFTsOnSale = async (req, res) => {
  try {
    let user = await UserModel.findById(req.user._id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    const marketplace = await getMarketplace(req.query.marketplaceId)
    if (!marketplace.success) {
      return res.status(400).json(marketplace)
    }

    let ownersData = await NftOwnersModel.find({ownerId: req.user._id});
    let nftIds = ownersData.map(data => data.nftId);
    console.log("NFT ids : ", nftIds);    

    const NFTs = await NftModel.find({
      _id: {$in : nftIds},
      isOnSale: req.params.onSale,
      marketplaceId: req.query.marketplace
    }).select("_id title nftURI description");

    return res.status(200).json({
      success: true,
      NFTs: NFTs,
    });
  } catch (error) {
    console.log("catch-error : ", error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};

const addNFTs = async (req,res) => {
    try {
        const requiredAttributes = [
            "title",
            "nftURI",
            "metadataURI",
            "nftFormat",
            "totalSupply"
        ];
        const imageFormats = JSON.parse(process.env.IMAGE_NFT_FORMATS_SUPPORTED);
        const NFT_formats = JSON.parse(process.env.NFT_FORMATS_SUPPORTED);
        
        const allPossibleAttributes = [
            "title",
            "description",
            "type",
            "nftURI",
            "metadataURI",
            "supplyType",
            "nftFormat",
            "previewImageURI",
            // "tokenSupply",
            "properties",
            "totalSupply"
        ];

    let missingAttribute, emptyAttributes;
    for (let i = 0; i < req.body.data.length; i++) {
      if (imageFormats.indexOf(req.body.data[i].nftFormat) === -1)
        requiredAttributes.push("previewImageURI");

      missingAttribute = checkMissingAttributes(
        req.body.data[i],
        requiredAttributes
      );

      if (missingAttribute != null) {
        return res.status(400).json({
          success: false,
          message: `${missingAttribute} not found in request body of NFT number: ${
            i + 1
          }!`,
        });
      }

      emptyAttributes = checkEmptyAttributes(
        req.body.data[i],
        requiredAttributes
      );
      if (emptyAttributes != null) {
        return res.status(400).json({
          success: false,
          message: `${emptyAttributes} was empty in request body of NFT number: ${
            i + 1
          }!`,
        });
      }
      requiredAttributes.pop();

      if (NFT_formats.indexOf(req.body.data[i].nftFormat) === -1) {
        return res.status(400).json({
          success: false,
          message: `NFT format is not supported for NFT number: ${i + 1}`,
        });
      }
    }

    const collectionId = req.body.collectionId;
    const requestBody = ["collectionId"];
    missingAttribute = checkMissingAttributes(req.body, requestBody);
    if (missingAttribute != null) {
      return res.status(400).json({
        success: false,
        message: missingAttribute + " not found in request body!",
      });
    }
    emptyAttributes = checkEmptyAttributes(req.body, requestBody);
    if (emptyAttributes != null) {
      return res.status(400).json({
        success: false,
        message: emptyAttributes + " was empty in request body!",
      });
    }

    const collectionResult = await getCollectionById(collectionId);
    if (!collectionResult.success) {
      return res.status(404).json({
        success: false,
        message: collectionResult.message,
      });
    }

    // const user = await UserModel.findOne({
    // 	email: req.user.email,
    // });

    const userId = req.user._id;
    let nftToCreate;
    for (let i = 0; i < req.body.data.length; i++) {
      nftToCreate = constructObject(req.body.data[i], allPossibleAttributes);
      nftToCreate["isMinted"] = false;
      nftToCreate["collectionId"] = collectionId;
      nftToCreate["minterId"] = userId;
      nftToCreate["ownerId"] = userId;
      nftToCreate["mintingType"] = "simple-mint";

      const randomId = generateUint256Id();
      nftToCreate["nftId"] = randomId;

      nftToCreate = new NftModel(nftToCreate);

      console.log("NFT: ", i + 1 + " created: " + nftToCreate);
      await NftModel.create(nftToCreate);

            collectionResult.collection.nftId.push(nftToCreate._id);
            await collectionResult.collection.save();

            await NftOwnersModel.create({
                ownerId: nftToCreate.ownerId,
                nftId: nftToCreate._id,
                supply: nftToCreate.totalSupply,
            });
        }
        return res.status(200).json({
            success: true,
            message:
                "NFT(s) added succesfully, awaiting minting from blockchain!",
        });
    } catch (error) {
        console.log("try-catch error: " + error);
        return res.status(500).json({
            success: false,
            err: error,
        });
    }
}

const getSingleNFT = async (req, res) => {
  try {
    const requiredAttributes = ["nftId"];

    const missingAttribute = checkMissingAttributes(
      req.params,
      requiredAttributes
    );

    if (missingAttribute != null) {
      return res.status(400).json({
        success: false,
        message: `${missingAttribute} not found in request params!`,
      });
    }

    const emptyAttributes = checkEmptyAttributes(
      req.params,
      requiredAttributes
    );
    if (emptyAttributes != null) {
      return res.status(400).json({
        success: false,
        message: `${emptyAttributes} was empty in request params!`,
      });
    }

    const nftResult = await getNFTsById(req.params.nftId);

    if (!nftResult.success)
      return res.status(404).json({
        success: false,
        message: nftResult.message,
      });

    return res.status(200).json({
      success: true,
      data: nftResult.NFTs,
    });
  } catch (error) {
    console.log("error (try-catch) : " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};

const getNFTsByCollection = async (req, res) => {
  try {
    const start = req.params.start;
    const end = req.params.end;

    const requiredAttributes = ["start", "end", "collectionId"];

        const missingAttribute = checkMissingAttributes(
            req.params,
            requiredAttributes
        );

    if (missingAttribute != null) {
      return res.status(400).json({
        success: false,
        message: `${missingAttribute} not found in request params!`,
      });
    }

    const emptyAttributes = checkEmptyAttributes(
      req.params,
      requiredAttributes
    );
    if (emptyAttributes != null) {
      return res.status(400).json({
        success: false,
        message: `${emptyAttributes} was empty in request params!`,
      });
    }

    const checkPagination = validatePaginationParams(start, end);
    if (checkPagination.success == false) {
      return res.status(400).json({
        success: false,
        message: checkPagination.message,
      });
    }

    const nftResult = await getNFTsByCollectionId(req.params.collectionId);
    if (!nftResult.success) {
      return res.status(404).json({
        success: false,
        message: nftResult.message,
      });
    }

    const reverse = nftResult.NFTs.reverse();
    const result = reverse.slice(start, end);

    console.log("paginated result: ", result);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.log("error (try-catch) : " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};

const updateMintedNFT = async (req, res) => {
  try {
    const requiredAttributes = ["txHash", "nftObjectId", "nftId"];

    const missingAttribute = checkMissingAttributes(
      req.body,
      requiredAttributes
    );
    if (missingAttribute != null) {
      return res.status(400).json({
        success: false,
        message: `${missingAttribute} not found in request body!`,
      });
    }
    requiredAttributes.pop();
    const emptyAttributes = checkEmptyAttributes(req.body, requiredAttributes);
    if (emptyAttributes != null) {
      return res.status(400).json({
        success: false,
        message: `${emptyAttributes} was empty in request body!`,
      });
    }

    let validateTxHashResult = validateTxHash(req.body.txHash);
    if (!validateTxHashResult.success) {
      return res.status(400).json({
        success: false,
        message: validateTxHashResult.message,
      });
    }

    const nftResult = await getNFTById(req.body.nftObjectId);
    if (!nftResult.success) {
      return res.status(404).json({
        success: false,
        message: nftResult.message,
      });
    }

    console.log("NFT: ", nftResult.NFT);

    const updateReport = await nftResult.NFT.updateOne({
      txHash: req.body.txHash,
      nftId: req.body.nftId,
    });
    console.log("updateReport: ", updateReport);

    return res.status(200).json({
      success: true,
      message: "NFT updated sucessfully!",
    });
  } catch (error) {
    console.log("error (try-catch) : " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};

const updateNFT = async (req, res) => {
  try {
    const requestParams = ["nftId"];

    const missingParams = checkMissingAttributes(req.params, requestParams);
    if (missingParams != null) {
      return res.status(400).json({
        success: false,
        message: missingParams + " not found in request params!",
      });
    }

		const possibleAttributes = [
			"title",
			"description",
			"type",
			"totalSupply",
			"supplyType",
			"properties",
			"metadataURI",
			"previewImageURI",
			"nftURI",
			"nftFormat",
			"nftId",
			"rarity"
		];
		const emptyAttributes = checkEmptyAttributes(
			{ ...req.body, nftId: req.params.nftId },
			possibleAttributes
		);
		if (emptyAttributes != null) {
			return res.status(400).json({
				success: false,
				message:
					emptyAttributes +
					" not found in request " +
					`${emptyAttributes != "nftId" ? "body!" : "params!"}`,
			});
		}

    const nftResult = await getNFTById(req.params.nftId);
    if (!nftResult.success) {
      return res.status(404).json({
        success: false,
        message: nftResult.message,
      });
    }
    console.log("NFT: ", nftResult.NFT);

		const updateReport = await nftResult.NFT.updateOne(req.body);
		console.log("updateReport: ", updateReport);

		return res.status(200).json({
			success: true,
			message: "NFT updated sucessfully!",
		});
	} catch (error) {
		console.log("error (try-catch) : " + error);
		return res.status(500).json({
			success: false,
			err: error,
		});
	}
};

const getNFTAndCollectionData = async (req, res) => {
	try {
		const requestParams = ["nftId", "collectionId"];

		const missingParams = checkMissingAttributes(req.params, requestParams);
		if (missingParams != null) {
			return res.status(400).json({
				success: false,
				message: missingParams + " not found in request params!",
			});
		}
		const emptyParams = checkEmptyAttributes(req.params, requestParams);
		if (emptyParams != null) {
			return res.status(400).json({
				success: false,
				message: emptyParams + " was empty in request params!",
			});
		}
		// let user = await UserModel.findOne({
		// 	email: req.user.email,
		// });
		// console.log("User : ", user);
		// if (!user) {
		// 	return res.status(400).json({
		// 		success: false,
		// 		message: "user don't exist against this walletAddress",
		// 	});
		// }

		const nftResult = await getNFTById(req.params.nftId);
		if (!nftResult.success) {
			return res.status(404).json({
				success: false,
				message: nftResult.message,
			});
		}

		console.log("NFT: ", nftResult.NFT);

		const collectionResult = await getCollectionById(req.params.collectionId);
		if (!collectionResult.success) {
			return res.status(404).json({
				success: false,
				message: collectionResult.message,
			});
		}

		console.log("collectionResult = ", collectionResult.collection);

		let data = {
			collectionName: collectionResult.collection.name,
			NftTitle: nftResult.NFT.title,
			ownedBy: collectionResult.collection.userId,
			description: collectionResult.collection.description,
			aboutNft: nftResult.NFT.description,
			contractAddress: collectionResult.collection.nftContractAddress,
			tokenId: collectionResult.collection.cloneId,
			tokenStandard: collectionResult.collection.contractType,
		};
		return res.status(200).json({
			success: true,
			data: data,
		});
	} catch (error) {
		console.log("error (try-catch) : " + error);
		return res.status(500).json({
			success: false,
			err: error,
		});
	}
};

const getCollection = async (req, res) => {
	try {
    // const marketplace = await getMarketplace(req.query.marketplaceId)
    // if (!marketplace.success) {
    //   return res.status(400).json(marketplace)
    // }

		let nfts = await NftModel.find({
			collectionId: req.params.collectionId,
			dropId: undefined,
      marketplaceId: req.query.marketplaceId
		})
    .select({
			_id: 1,
			title: 1,
			nftURI: 1,
			nftId: 1,
			totalSupply: 1,
			previewImageURI: 1,
      supplyType: 1,
      nftFormat: 1,
      collectionId:1,
      description:1,
      properties:1
		})
    .populate({
      path: "collectionId",
      select: "name"
    });
    
    //  if (nfts.length === 0) {
    //     return res.status(404).json({
    //         success: false,
    //         message: "No NFTs were found against provided Collection Id!",
    //     });
    // }

    if (nfts.length > 0) {
      let nftIds = nfts.map(data => data._id);

      let ownersData = await NftOwnersModel.find({
        nftId: {$in : nftIds},
        ownerId: req.user._id
      });
    
      console.log("NFTs : ",nfts)

      nfts = JSON.stringify(nfts)
      nfts = JSON.parse(nfts)

      let data;
      for(let i = 0; i< nfts.length; i++){
        data = ownersData.find(data => data.nftId.equals(nfts[i]._id)); 
        console.log("DATA : ", data)
        nfts[i].ownedSupply = data.supply;

        // console.log("Supply: ",paginationResult[i].supply);
      }

      console.log('count: ', nfts.length)
    }
    return res.status(200).json({
        success: true,
        data: nfts,
    });
    } catch (error) {
        console.log("error (try-catch) : " + error);
        return res.status(500).json({
            success: false,
            err: error,
        });
    }
}

module.exports = {
	getMyNFTs,
	getMyNFTsOnSale,
	addNFTs,
	getSingleNFT,
	getNFTsByCollection,
	updateMintedNFT,
	updateNFT,
	getNFTAndCollectionData,
	getCollection,
	getNFTs,
	getNFTsOnSale,
	getRarities,
};

