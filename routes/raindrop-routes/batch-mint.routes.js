var express = require("express");
var assetRouter = express.Router();

const auth = require("../middlewares/auth");
const { checkIsProfileAdded } = require("../middlewares/profileMiddleware");
const { checkIsInRole } = require("../middlewares/authCheckRole");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});
const {
  checkMissingAttributes,
  checkEmptyAttributes,
  constructObject,
} = require("../utils/requestBody");
const { calculateRarity } = require("../utils/open-rarity");

const UserModel = require("../models/UserModel");
const NftModel = require("../models/NFTModel");
const collectionModel = require("../models/CollectionModel");
const BatchMint = require("../models/BatchModel");
const RarityModel = require("../models/RarityModel");

assetRouter
  .route("/")
  .post(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const requiredAttributes = [
          "title",
          "collectionId",
          "nftFormat",
          "nftURI",
          "metadataURI",
        ];
        const imageFormats = ["png", "jpg", "gif", "jpeg"];
        const allPossibleAttributes = [
          "title",
          "description",
          "type",
          "nftURI",
          "metadataURI",
          "supplyType",
          "nftFormat",
          "previewImageURI",
          "tokenSupply",
          "properties",
          "collectionId",
        ];

        const format = req.body.nftFormat;
        if (format == undefined) {
          return res.status(400).json({
            success: false,
            message: `nftFormat not found in request body!`,
          });
        }
        if (format === "") {
          return res.status(400).json({
            success: false,
            message: `nftFormat was empty in request body!`,
          });
        }

        if (imageFormats.indexOf(format) === -1) {
          requiredAttributes.push("previewImageURI");
          allPossibleAttributes.push("previewImageURI");
        }

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
        const emptyAttributes = checkEmptyAttributes(
          req.body,
          requiredAttributes
        );
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: `${emptyAttributes} was empty in request body!`,
          });
        }

        // Get the collection to put this NFT into
        const collection = await collectionModel.findOne({
          _id: req.body.collectionId,
        });

        if (!collection) {
          return res.status(404).json({
            success: false,
            message: "Collection not found against provided Collection Id!",
          });
        }

        const user = await UserModel.findOne({
          walletAddress: req.user.walletAddress,
        });
        const userId = user._id;

        let NFT = constructObject(req.body, allPossibleAttributes);
        NFT["minterId"] = userId;
        NFT["ownerId"] = userId;
        NFT["mintingType"] = "batch-mint";

        const NFTs = await NftModel.find({
          _id: { $in: collection.nftId },
        }).select("properties");

        NFT = new NftModel(NFT);
        NFT = await NftModel.create(NFT);

        const nftId = NFT._id;
        collection.nftId.push(nftId);
        await collection.save();

        const batch = await BatchMint.create({
          userId: userId,
          nftIds: nftId,
          collectionId: req.body.collectionId,
        });
        console.log("batch: ", batch);

        await NFT.updateOne({
          $set: { batchId: batch._id },
        });

        if (NFTs.length != 0) {
          const properties = [];
          for (let i = 0; i < NFTs.length; i++) {
            if (NFTs[i].properties != undefined) {
              properties[i] = NFTs[i].properties;
            }
          }
          if (properties.length != 0) {
            console.log("properies: ", properties);

            const ranking = calculateRarity(properties);
            const rarities = calculateRarity(properties, false);

            console.log("rarity ranking: ", ranking);
            console.log("property rarity: ", rarities);

            for (let i = 0; i < NFTs.length; i++) {
              console.log(
                "NFT with id " +
                  NFT._id +
                  " assigned rank " +
                  ranking[ranking[i].tokenId].rank
              );
              await NFTs[i].updateOne({
                rank: ranking[ranking[i].tokenId].rank,
              });
            }

            const setRarities = await RarityModel.create({
              collectionId: req.body.collectionId,
              rarities: rarities,
            });
          }
        }

        return res.status(200).json({
          success: true,
          batchId: batch._id,
          nftId: nftId,
          message: "Batch created successfully!",
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

assetRouter
  .route("/:batchId")
  .get(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        if (!req.params.batchId) {
          return res.status(400).json({
            success: false,
            message: "batchId not found in the params",
          });
        }

        const batch = await BatchMint.findOne({ _id: req.params.batchId });

        if (!batch) {
          return res.status(404).json({
            success: false,
            message: "no batch found against provided batchId.",
          });
        }

        return res.status(200).json({
          success: true,
          batchData: batch,
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

assetRouter
  .route("/tx-hash")
  .put(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const requiredAttributes = ["batchId", "txHash"];
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

        const emptyAttributes = checkEmptyAttributes(
          req.body,
          requiredAttributes
        );
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: `${emptyAttributes} was empty in request body!`,
          });
        }

        const batch = await BatchMint.findById(req.body.batchId);

        if (!batch) {
          return res.status(404).json({
            success: false,
            message: "No batch found against provided batchId.",
          });
        }
        console.log("batch: ", batch);

        batch.txHash = req.body.txHash;
        await batch.save();

        return res.status(200).json({
          success: true,
          message: "transaction hash sucessfully added",
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

assetRouter
  .route("/:batchId")
  .delete(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const batchId = req.params.batchId;
        if (!batchId) {
          return res.status(400).json({
            success: false,
            message: "batchId not found in the params",
          });
        }

        const batch = await BatchMint.findById(batchId);
        if (!batch) {
          return res.status(404).json({
            success: false,
            message: "no batch found against provided batchId.",
          });
        }

        const NFTs = await NftModel.find({
          batchId: req.params.batchId,
        }).select({ _id: 1, collectionId: 1 });
        const collection = await collectionModel.findById(NFTs[0].collectionId);
        const start = collection.nftId.indexOf(NFTs[0]._id);
        const end = start + NFTs.length;
        const toDelete = collection.nftId.slice(start, end);

        // Delete the batch
        await BatchMint.deleteOne({ _id: batchId });

        // Delete the associated NFTs
        await NftModel.deleteMany({ batchId: batchId });

        // Remove NFTs Ids from Collection
        await collection.updateOne({ $pullAll: { nftId: toDelete } });

        return res.status(200).json({
          success: true,
          message: "Requested batch removed",
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

assetRouter
  .route("/nft")
  .post(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const requiredAttributes = [
          "title",
          "collectionId",
          "nftFormat",
          "nftURI",
          "metadataURI",
          "batchId",
        ];
        const imageFormats = ["png", "jpg", "gif", "jpeg"];
        const allPossibleAttributes = [
          "title",
          "description",
          "type",
          "nftURI",
          "metadataURI",
          "supplyType",
          "nftFormat",
          "previewImageURI",
          "tokenSupply",
          "properties",
          "collectionId",
          "collectionId",
          "batchId",
        ];

        const format = req.body.nftFormat;
        if (format == undefined) {
          return res.status(400).json({
            success: false,
            message: `nftFormat not found in request body!`,
          });
        }
        if (format === "") {
          return res.status(400).json({
            success: false,
            message: `nftFormat was empty in request body!`,
          });
        }

        if (imageFormats.indexOf(format) === -1) {
          requiredAttributes.push("previewImageURI");
          allPossibleAttributes.push("previewImageURI");
        }

        const missingAttribute = checkMissingAttributes(
          req.body,
          requiredAttributes
        );
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: missingAttribute + " not found in request body!",
          });
        }
        const emptyAttributes = checkEmptyAttributes(
          req.body,
          requiredAttributes
        );
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: emptyAttributes + " was empty in request body!",
          });
        }

        const user = await UserModel.findOne({
          walletAddress: req.user.walletAddress,
        });

        let collection = await collectionModel.findById(req.body.collectionId);

        if (!collection) {
          return res.status(404).json({
            success: false,
            message: "Collection not found against provided Collection Id!",
          });
        }

        let batch = await BatchMint.findById(req.body.batchId);
        if (!batch) {
          return res.status(404).json({
            success: false,
            message: "Batch not found against provided batchId!",
          });
        }
        console.log("batch: ", batch);

        let NFT = constructObject(req.body, allPossibleAttributes);

        const userId = user._id;
        NFT["minterId"] = userId;
        NFT["ownerId"] = userId;
        NFT["mintingType"] = "batch-mint";

        const NFTs = await NftModel.find({
          _id: { $in: collection.nftId },
        }).select("properties");

        NFT = new NftModel(NFT);
        NFT = await NftModel.create(NFT);

        const nftId = NFT._id;

        collection.nftId.push(nftId);
        await collection.save();

        batch.nftIds.push(nftId);
        await batch.save();

        if (NFTs.length !== 0) {
          const properties = [];
          for (let i = 0; i < NFTs.length; i++) {
            if (NFTs[i].properties != undefined) {
              properties[i] = NFTs[i].properties;
            }
          }

          if (properties.length != 0) {
            console.log("properies: ", properties);

            const ranking = calculateRarity(properties);
            const rarities = calculateRarity(properties, false);

            console.log("rarity ranking: ", ranking);
            console.log("property rarity: ", rarities);

            for (let i = 0; i < NFTs.length; i++) {
              console.log(
                "NFT with id " +
                  NFT._id +
                  " assigned rank " +
                  ranking[ranking[i].tokenId].rank
              );
              await NFTs[i].updateOne({
                rank: ranking[ranking[i].tokenId].rank,
              });
            }

            const setRarities = await RarityModel.create({
              collectionId: req.body.collectionId,
              rarities: rarities,
            });
          }
        }

        return res.status(200).json({
          success: true,
          nftId: nftId,
          message:
            "NFT created and added to collection and batch created successfully!",
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

// assetRouter.route("/batch-mint/nft").put(
// 	auth.verifyToken,
// 	verifyUser,
// 	checkIsInRole("user", "admin"),
//  checkIsProfileAdded("admin"),
// 	async function (req, res, next) {
// 		try {
// 			const requiredAttributes = ['nftObjectId', 'nftFormat', 'nftURI', 'metadataURI'];
//       const imageFormats = ['png', 'jpg', 'gif', 'jpeg'];

//       const format = req.body.nftFormat;
//       if (!format) {
//         return res.status(400).json({
//           success: false,
//           message: "nftFormat not found in request body",
//         });
//       }
//       if (format === '') {
//         return res.status(400).json({
//           success: false,
//           message: "nftFormat is empty in request body",
//         });
//       }

//       let isImage = true;
//       if(imageFormats.indexOf(format) === -1) isImage = false;
//       if (!isImage) requiredAttributes.push('previewImageURI');

// 			const missingParams = checkMissingAttributes(req.body, requiredAttributes);
// 			if (missingParams != null) {
// 				return res.status(400).json({
// 					success: false,
// 					message: missingParams + " not found in request body!",
// 				});
// 			}

// 			const emptyParams = checkEmptyAttributes(req.body, requiredAttributes);
// 			if (emptyParams != null) {
// 				return res.status(400).json({
// 					success: false,
// 					message: emptyParams + " was empty in request body!",
// 				});
// 			}

// 			let NFT = await NftModel.findById(req.body.nftObjectId);

// 			if (!NFT) {
// 				return res.status(404).json({
// 					success: false,
// 					message: "Provided NFT Id does not any existing NFT",
// 				});
// 			}

//       NFT.nftFormat = format;
//       NFT.nftURI = req.body.nftURI;
//       NFT.metadataURI = req.body.metadataURI;

//       if (!isImage) NFT.previewImageURI = req.body.previewImageURI;

//       await NFT.save();

//       return res.status(200).json({
// 				success: true,
// 				message: "Nft Updated successfully!",
// 			});
// 		} catch (err) {
// 			console.log("error (try-catch) : " + err);
// 			return res.status(500).json({
// 				success: false,
// 				err: err,
// 			});
// 		}
// 	}
// );

assetRouter
  .route("/nft/:nftObjId")
  .delete(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const nftId = req.params.nftObjId;
        if (!nftId) {
          return res.status(400).json({
            success: false,
            message: "nftObjId not found in the params",
          });
        }

        const NFT = await NftModel.findById(nftId);

        if (!NFT) {
          return res.status(404).json({
            success: false,
            message: "Provided NFT Id does not match any existing NFT",
          });
        }

        const collection = await collectionModel.findById(NFT.collectionId);
        const batch = await BatchMint.findById(NFT.batchId);

        await NFT.deleteOne();
        await collection.updateOne({ $pull: { nftId: nftId } });
        await batch.updateOne({ $pull: { nftIds: nftId } });

        return res.status(200).json({
          success: true,
          message: "NFT deleted successfully and associated documents updated!",
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

assetRouter
  .route("/minted/:batchId")
  .put(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        if (!req.body.blockchainIds) {
          return res.status(400).json({
            success: false,
            message: `blockchainIds parameter not found in request body!`,
          });
        }

        const batch = await BatchMint.findById(req.params.batchId);

        if (!batch) {
          return res.status(404).json({
            success: false,
            message: "No batch found against provided batchId.",
          });
        }
        console.log("batch: ", batch);

        if (batch.nftIds.length !== req.body.blockchainIds.length) {
          return res.status(400).json({
            success: false,
            message:
              "blockchainIds sent in request body didnt match the amount of NFTs in the batch!",
          });
        }

        for (let i = 0, filter, updation; i < batch.nftIds.length; ++i) {
          filter = { _id: batch.nftIds[i] };
          updation = {
            nftId: req.body.blockchainIds[i],
            isMinted: true,
          };

          const report = await NftModel.updateOne(filter, updation);
          console.log({ report });
        }

        return res.status(200).json({
          success: true,
          message: "NFTs sucessfully updated",
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

assetRouter
  .route("/collection")
  .put(
    auth.verifyToken,
    verifyUser,
    checkIsInRole("admin"),
    checkIsProfileAdded("admin"),
    async function (req, res, next) {
      try {
        const requiredAttributes = ["batchId", "collectionId"];

        const missingParams = checkMissingAttributes(
          req.body,
          requiredAttributes
        );
        if (missingParams != null) {
          return res.status(400).json({
            success: false,
            message: missingParams + " not found in request body!",
          });
        }

        const emptyParams = checkEmptyAttributes(req.body, requiredAttributes);
        if (emptyParams != null) {
          return res.status(400).json({
            success: false,
            message: emptyParams + " was empty in request body!",
          });
        }

        const batch = await BatchMint.findById(req.body.batchId);
        if (!batch) {
          return res.status(404).json({
            success: false,
            message: "Provided batch Id does not any existing batch",
          });
        }

        const targetCollection = await collectionModel.findById(
          req.body.collectionId
        );
        if (!targetCollection) {
          return res.status(404).json({
            success: false,
            message: "Collection to update not found",
          });
        }

        const sourceCollection = await collectionModel.findById(
          batch.collectionId
        );
        if (!sourceCollection) {
          return res.status(404).json({
            success: false,
            message: "sourceCollection to update not found",
          });
        }

        batch.collectionId = req.body.collectionId;
        const ids = batch.nftIds;
        console.log("ids: ", ids);

        const updateReport = await NftModel.updateMany(
          { _id: { $in: ids } },
          { collectionId: req.body.collectionId }
        );

        console.log("updateReport: ", updateReport);

        const pullReport = await sourceCollection.updateOne({
          $pullAll: { nftId: ids },
        });
        console.log("pullReport: ", pullReport);

        targetCollection.nftId = ids;
        targetCollection.save();
        batch.save();

        return res.status(200).json({
          success: true,
          message: "Collection moved!",
        });
      } catch (err) {
        console.log("error (try-catch) : " + err);
        return res.status(500).json({
          success: false,
          err: err,
        });
      }
    }
  );

module.exports = assetRouter;
