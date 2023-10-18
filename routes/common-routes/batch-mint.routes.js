var express = require("express");
var assetRouter = express.Router();

const auth = require("../../middlewares/auth");
const multer = require('multer');

const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});
const fs = require("fs");
const fsPromises = require("fs/promises")
const path = require('path');
const {checkMissingAttributes, checkEmptyAttributes, constructObject} = require('../../utils/request-body');
const { calculateRarity } = require('../../utils/open-rarity');
const { generateUint256Id } = require('../../utils/blockchain');

const NftModel = require("../../models/NFTModel");
const collectionModel = require("../../models/CollectionModel");
const BatchMint = require("../../models/BatchModel");
const RarityModel = require("../../models/RarityModel");
const NftOwnersDataModel = require("../../models/NFTOwnersData");
const { checkNull } = require("../utils/validateRequest");
const { extractFile } = require("../utils/extractFile");
const upload = multer({ dest: 'public/uploads' })
const { resolve } = require("path");
const { listDir, checkFileOccourenceInArray } = require("../utils/directory-fs");
const { uploadToIpfs, uploadMetadataToIpfs } = require("../utils/uploadToIpfs");
const MarketplaceModel = require("../../models/MarketplaceModel");

assetRouter
  .route("/")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const requiredAttributes = [
          "title",
          "collectionId",
          "nftFormat",
          "nftURI",
          "metadataURI",
          "totalSupply",
          "marketplaceId"
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
          "marketplaceId",
          "properties",
          "collectionId",
          "totalSupply"
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
        if (!MarketplaceModel.findById(req.body.marketplaceId)) {
          return res.status(400).json({
            success: false,
            message: "Marketplace not registered",
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

        // const user = await UserModel.findOne({
        //   email: req.user.email,
        // });
        const userId = req.user._id;

        let NFT = constructObject(req.body, allPossibleAttributes);
        NFT["minterId"] = userId;
        NFT["ownerId"] = userId;
        NFT["mintingType"] = "batch-mint";

        const randomId = generateUint256Id();
        NFT["nftId"] = randomId;

        const NFTs = await NftModel.find({
          _id: { $in: collection.nftId },
        }).select("properties");

        NFT = new NftModel(NFT);
        NFT = await NftModel.create(NFT);

      await NftOwnersDataModel.create({
          ownerId: NFT.ownerId,
          nftId: NFT._id,
          supply: NFT.totalSupply,
      });

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
    auth.checkIsInRole("user", "admin"),
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
  .route("/finalize/:batchId")
  .patch(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        
        if(req.params.batchId == undefined){
          return res.status(400).json({
            success: false,
            message: "No batchId found in the request params."
          })
        }

        if(req.params.batchId == ""){
          return res.status(400).json({
            success: false,
            message: "BatchId found empty in the request params."
          })
        }

        const batch = await BatchMint.findById(req.params.batchId);

        if (!batch) {
          return res.status(400).json({
            success: false,
            message: "No batch found against provided batchId.",
          });
        }
        console.log("batch: ", batch);

        if(batch.isBatchCreated === true){
          return res.status(400).json({
            success: false,
            message: "Batch already finalized."
          })
        }
        
        const nfts = await NftModel.updateMany({
          _id: {$in : batch.nftIds},
          isBatchCreated: false
        },{
          isBatchCreated: true
        })

        if (nfts.modifiedCount == 0 ) {
          return res.status(400).json({
            success: false,
            message: "No nft found against provided nftId.",
          });
        }
        console.log("nfts: ", nfts);

        await batch.updateOne({
          isBatchCreated: true
        })

        return res.status(200).json({
          success: true,
          message: "Batch has been created on blockchain.",
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
    auth.checkIsInRole("user", "admin"),
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
    auth.checkIsInRole("user", "admin"),
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

        if(batch.isBatchCreated == true){
          return res.status(400).json({
            success: false,
            message: "Cannot delete nft because it's batch is already finalized."
          })
        }

        const NFTs = await NftModel.find({
          batchId: req.params.batchId,
        }).select({ _id: 1, collectionId: 1 , isBatchCreated: 1 });
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

assetRouter.route("/nft").post(
  auth.verifyToken,
  verifyUser,
  auth.checkIsInRole("user", "admin"),

  async function (req, res, next) {
    try {
      const requiredAttributes = [
        "title",
        "collectionId",
        "nftFormat",
        "nftURI",
        "metadataURI",
        "batchId",
        "totalSupply",
        "marketplaceId"
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
        "marketplaceId",
        "properties",
        "collectionId",
        "totalSupply",
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

      // const user = await UserModel.findOne({
      //   email: req.user.email,
      // });

      if (!MarketplaceModel.findById(req.body.marketplaceId)) {
        return res.status(400).json({
          success: false,
          message: "Marketplace not registered",
        });
      }

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

      const userId = req.user._id;
      NFT["minterId"] = userId;
      NFT["ownerId"] = userId;
      NFT["mintingType"] = "batch-mint";

      const randomId = generateUint256Id();
      NFT["nftId"] = randomId;

      const NFTs = await NftModel.find({
        _id: { $in: collection.nftId },
      }).select("properties");

      NFT = new NftModel(NFT);
      NFT = await NftModel.create(NFT);
      await NftOwnersDataModel.create({
        ownerId: NFT.ownerId,
        nftId: NFT._id,
        supply: NFT.totalSupply,
    });

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
            await NFTs[i].updateOne({ rank: ranking[ranking[i].tokenId].rank });
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
// 	auth.checkIsInRole("user", "admin"),

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

assetRouter.route("/nft/:nftObjId").delete(
  auth.verifyToken,
  verifyUser,
  auth.checkIsInRole("user", "admin"),

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

      if (NFT.isBatchCreated == true) {
        return res.status(404).json({
          success: false,
          message: "Cannot delete nft because it is already created on blockchain.",
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
    auth.checkIsInRole("user", "admin"),
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

assetRouter.route("/collection").put(
  auth.verifyToken,
  verifyUser,
  auth.checkIsInRole("user", "admin"),

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

assetRouter
  .route("/multiple")
  .post(
    auth.verifyToken,
    verifyUser,
    upload.single("nfts"),
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {

        const cResult = checkNull("Collection Id", req.body.collectionId);

        if (!cResult.success)
          return res.status(400).send(cResult);

        let collectionId = req.body.collectionId;

        let collection = await collectionModel.findOne({
          _id: collectionId
        });

        if (!collection) {
          return res.status(404).json({
            success: false,
            message: `Collection not found against provided Collection Id!`,
          });
        }

        if (!req.file)
          return res.json({
            success: false,
            message: "nfts file not found!"
          });

        const dest = (resolve("public/uploads"));
        const result = await extractFile(req.file.path, dest);

        if (!result.success)
          return res.json(result);

        const nftPath = "public/uploads/nfts"
        const files = await listDir(nftPath);

        if (!files.success)
          return res.status(500).json(files);

        const fullPath = path.join(__dirname, `../../${nftPath}`)
        const zippPath = path.join(__dirname, `../../${req.file.path}`)

        const requiredAttributes = ['title', 'nftFormat', /*'nftURI', 'metadataURI'*/];
        const imageFormats = ['png', 'jpg', 'gif', 'jpeg'];
        const allPossibleAttributes = [
          'title', 'description', 'type', 'nftURI', 'metadataURI', 'supplyType',
          'nftFormat', 'tokenSupply', 'properties', //'previewImageURI'
        ];
        const invalidNFTs = {};
        const missingImageFormat = []
        let batch;
        const userId = req.user._id;
        console.log("UserId", userId);

        for (const json in files.json) {

          let filename = files.json[json];
          console.log("At file ", filename);
          nftJSONfile = require(`${fullPath}/${filename}`);
          const result = checkFileOccourenceInArray(path.parse(filename).name, files.files);

          if (!result) {
            invalidNFTs[filename] = "Image file not found";
            console.log("Continuing: Image file not found")
            continue;
          }

          const format = nftJSONfile.nftFormat;

          console.log("Format ", format);

          if (format == undefined) {
            invalidNFTs[filename] = "nftFormat not found in JSON";
            console.log("Continuing: nftFormat not found in JSON")
            continue;
          }

          if (format === '') {
            invalidNFTs[filename] = "nftFormat was empty in JSON";
            console.log("Continuing: nftFormat was empty in JSON")
            continue;
          }

          if (imageFormats.indexOf(format) === -1) {
            // create preview image URI
            //   requiredAttributes.push('previewImageURI');
            //   allPossibleAttributes.push('previewImageURI');
            missingImageFormat.push(filename);
          }
        }

        for (const json in files.json) {
          console.log("In loop # 2")
          let filename = files.json[json];
          let imageName = files.files[json];

          if(Object.keys(invalidNFTs).includes(filename)){
            console.log("Loop 2: Continuing for ", filename);
            continue;
          }
          console.log("At file, Next Loop ", filename);
          const sNFT = require(`${fullPath}/${filename}`);
          console.log("NFT : ", sNFT);

          if (missingImageFormat.includes(filename)) {
            requiredAttributes.push("previewImageURI");
            // allPossibleAttributes.push("previewImageURI");
          }
          
          const missingAttribute = checkMissingAttributes(sNFT, requiredAttributes);

          if (missingAttribute != null) {
            invalidNFTs[filename] = `${missingAttribute} not found in JSON`;
            console.log(`Continuing: ${missingAttribute} not found in JSON`);
            continue;
          }

          const emptyAttributes = checkEmptyAttributes(sNFT, requiredAttributes);

          if (emptyAttributes != null) {
            invalidNFTs[filename] = `${missingAttribute} was empty in JSON`;
            console.log(`Continuing: ${missingAttribute} was empty in JSON`);
            continue;
          }

          const ipfsImageResp = await uploadToIpfs(`${fullPath}/${imageName}`, imageName);

          if(!ipfsImageResp.success){
            invalidNFTs[filename] = {
              message: "Error in uploading Image file.",
              err: ipfsImageResp.err,
            };
            console.log("Continuing: IPFS image error")
            continue;
          }
          console.log("Image uploaded to IPFS");
          sNFT.nftURI = `${process.env.IPFS_URL}`+ `${ipfsImageResp.IpfsData.IpfsHash}`;

          const metadata = {
            name: sNFT.title,
            description: sNFT.description,
            image: sNFT.nftURI,
            // external_url: "https://example.com/my-nft",
            // attributes: [
            //   {
            //     trait_type: Color,
            //     value: Red
            //   },
            //   {
            //     trait_type: Shape,
            //     value: Square
            //   }
            // ]
          }

          if(sNFT.collection)
            metadata.collection = sNFT.collection

          if(sNFT.youtube_url)
            metadata.youtube_url = sNFT.youtube_url          

          if(sNFT.animation_url)
            metadata.animation_url = sNFT.animation_url

          if(sNFT.external_url)
            metadata.external_url = sNFT.external_url

          if(sNFT.attributes)
            metadata.attributes = sNFT.attributes

          
          const ipfsMetadataResp = await uploadMetadataToIpfs(metadata);

          if(!ipfsMetadataResp.success){
            invalidNFTs[filename] = {
              message: "Error in uploading JSON.",
              err: ipfsMetadataResp.err,
            };
            console.log("Continuing: IPFS JSON error")
            continue;
          }

          sNFT.metadataURI = `${process.env.IPFS_URL}`+`${ipfsMetadataResp.IpfsData.IpfsHash}`;
          console.log("Metadata uploaded to IPFS");

          console.log("Constructing NFT:");
          let NFT = constructObject(sNFT, allPossibleAttributes);
          NFT["minterId"] = userId;
          NFT["ownerId"] = userId;
          NFT["mintingType"] = 'batch-mint';
          NFT["collectionId"] = collectionId

          const randomId = generateUint256Id();
          NFT["nftId"] = randomId;
          console.log('Constructed NFT : ', NFT);
          const NFTs = await NftModel.find({
            _id: { $in: collection.nftId }
          }).select('properties');
          console.log("Creating New Model........");

          NFT = new NftModel(NFT);
          NFT = await NftModel.create(NFT);

          console.log("Saving collection........");
          const nftId = NFT._id;
          collection.nftId.push(nftId);
          await collection.save();
          console.log("Updating Batch........");

          if (!batch) { // if batch is not initialized
            batch = await BatchMint.create({
              userId: userId,
              nftIds: [nftId],
              collectionId: collectionId
            });
            console.log('batch: ', batch);
          }
          else {
            batch.nftIds.push(nftId);
            await batch.save();
          }
          console.log("Updating NFT........");

          await NFT.updateOne({
            $set: { 'batchId': batch._id }
          });
          console.log("Setting Rarity of NFT........");

          if (NFTs.length != 0) {
            const properties = []
            for (let i = 0; i < NFTs.length; i++) {
              if (NFTs[i].properties != undefined) {
                properties[i] = NFTs[i].properties
              }
            }
            if (properties.length != 0) {
              console.log('properies: ', properties);

              const ranking = calculateRarity(properties);
              const rarities = calculateRarity(properties, false);

              console.log('rarity ranking: ', ranking)
              console.log('property rarity: ', rarities)

              for (let i = 0; i < NFTs.length; i++) {
                console.log('NFT with id ' + NFT._id + ' assigned rank ' + ranking[ranking[i].tokenId].rank)
                await NFTs[i].updateOne({ rank: ranking[ranking[i].tokenId].rank })
              }

              const setRarities = await RarityModel.create({
                collectionId: collectionId,//sNFT.collectionId,
                rarities: rarities
              })
            }
          }
          
          requiredAttributes.pop();
          allPossibleAttributes.pop();
        }

        let response = {
          success: false,
          errors: invalidNFTs,
          message: "Batch not created due to invalid Nfts!",
        }

        // removing zipped file and extracted folder 
        fs.unlinkSync(zippPath);
        await fsPromises.rm(fullPath, { recursive: true });

        if (batch)
          response = {
            success: true,
            batchId: batch._id,
            errors: Object.keys(invalidNFTs).length ? invalidNFTs : "No errors found.",
            message: "Batch created successfully!",
          }
        
        return res.status(200).json(response);

      } catch (error) {
        console.log("error (try-catch) : " + error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    }
  );

module.exports = assetRouter;