var express = require("express");
var assetRouter = express.Router();

const auth = require("../../middlewares/auth");

const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});
const {
  checkMissingAttributes,
  checkEmptyAttributes,
  validatePaginationParams,
} = require("../../utils/request-body");

const UserModel = require("../../models/UserModel");
const collectionModel = require("../../models/CollectionModel");
const NftModel = require("../../models/NFTModel");
const RarityModel = require("../../models/RarityModel");
const BidModel = require("../../models/BidModel");

const fileManager = require("../../actions/fileManager");
const { getMarketplace } = require("../utils/routes-utils/marketplace")
const fs = require("fs");
const AWS = require("aws-sdk");
const Web3 = require("web3");
const BigNumber = require("bignumber.js");
const MarketplaceModel = require("../../models/MarketplaceModel");
const CategoryModel = require("../../models/CategoryModel");

assetRouter.route("/").post(
  auth.verifyToken,
  verifyUser,
  auth.checkIsInRole("user", "admin"),
  fileManager.uploadDocument.fields([
    {
      name: "thumbnail",
      maxCount: process.env.MAX_NO_OF_IMAGES,
    },
    {
      name: "banner",
      maxCount: process.env.MAX_NO_OF_IMAGES,
    },
  ]),

  async function (req, res, next) {
    try {
      const requestBody = [
        "name",
        "symbol",
        "description",
        "categoryId",
        "contractType",
        "marketplaceId",
      ];
      const requestFiles = ["thumbnail"];
      if (req.files.banner) {
        requestFiles.push("banner");
      }
      const missingAttribute = checkMissingAttributes(req.body, requestBody);
      if (missingAttribute != null) {
        fileManager.DeleteFile(req.files.thumbnail[0].path);
        return res.status(400).json({
          success: false,
          message: missingAttribute + " not found in request body!",
        });
      }
      const emptyAttributes = checkEmptyAttributes(req.body, requestBody);
      if (emptyAttributes != null) {
        fileManager.DeleteFile(req.files.thumbnail[0].path);
        return res.status(400).json({
          success: false,
          message: emptyAttributes + " was empty in request body!",
        });
      }
      const missingFiles = checkMissingAttributes(req.files, requestFiles);
      if (missingFiles != null) {
        return res.status(400).json({
          success: false,
          message: missingFiles + " is missing in request files!",
        });
      }

      const category = await CategoryModel.findById(req.body.categoryId)
      if (!category) {
        fileManager.DeleteFile(req.files.thumbnail[0].path);
        return res.status(404).json({
          success: false,
          message: "category not found",
        });
      }

      if (
        (req.body.royaltyFee && req.body.royaltyFee < 0) ||
        req.body.royaltyFee > 100
      ) {
        fileManager.DeleteFile(req.files.thumbnail[0].path);
        return res.status(400).json({
          success: false,
          message:
            "Inappropriate royalty fees value set. It must be a percentage.",
        });
      }

      if (req.body.royaltyFee) {
        const royalty = req.body.royaltyFee;
        const decimalPart = royalty.toString().split('.')[1];
        if (decimalPart) {
          const decimalPlaces = decimalPart.length;
          console.log('decimals ', decimalPlaces); 
          if (decimalPlaces > 4) {
            fileManager.DeleteFile(req.files.thumbnail[0].path);
            return res.status(400).json({
              success: false,
              message:
                "Precision of royalty fee percentage is supported upto 4 decimals places.",
            });  
          }
        }

      }

      const result = await UserModel.findOne({
        _id: req.user._id,
      });

      if (!result) {
        fileManager.DeleteFile(req.files.thumbnail[0].path);
        if (req.files.banner) fileManager.DeleteFile(req.files.banner[0].path);
        return res.status(400).json({
          success: false,
          message: "User not found.",
        });
      }

      if (!MarketplaceModel.findById(req.body.marketplaceId)) {
        fileManager.DeleteFile(req.files.thumbnail[0].path);
        if (req.files.banner) fileManager.DeleteFile(req.files.banner[0].path);
        return res.status(400).json({
          success: false,
          message: "Marketplace not registered",
        });
      }
      
      const s3 = new AWS.S3({
        accessKeyId: process.env.S3_ACCESS_ID,
        secretAccessKey: process.env.S3_ACCESS_SECRET,
      });

      const fileContentThumbnail = fs.readFileSync(req.files.thumbnail[0].path);
      console.log("fileContentThumbnail :", fileContentThumbnail);

      const uploadImage = await s3
        .upload({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: req.files.thumbnail[0].originalname,
          Body: fileContentThumbnail,
          ACL: "public-read",
        })
        .promise();

      var newcollection = new collectionModel({
        userId: result._id,
        name: req.body.name,
        symbol: req.body.symbol,
        // nftContractAddress: req.body.nftContractAddress,
        thumbnail: uploadImage.Location,
        // banner: uploadBanner.Location,
        description: req.body.description,
        categoryId: req.body.categoryId,
        contractType: req.body.contractType,
        marketplaceId: req.body.marketplaceId,
      });
      if (req.files.banner) {
        const fileContentBanner = fs.readFileSync(req.files.banner[0].path);
        console.log("fileContentBanner :", fileContentBanner);
        const uploadBanner = await s3
          .upload({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: req.files.banner[0].originalname,
            Body: fileContentBanner,
            ACL: "public-read",
          })
          .promise();
        newcollection["banner"] = uploadBanner.Location;
      }
      if (req.body.royaltyFee)
        newcollection["royaltyFee"] = req.body.royaltyFee;

      await collectionModel.create(newcollection);

      fileManager.DeleteFile(req.files.thumbnail[0].path);
      return res.status(200).json({
        success: true,
        message: "Collection created successfully!",
        collection: newcollection,
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
  .route("/rarities/:collectionId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const collection = await collectionModel.findOne({
          _id: req.params.collectionId,
        });
        console.log("collection: ", collection);

        if (!collection) {
          return res.status(404).json({
            success: false,
            message: "Collection not found against provided collectionId.",
          });
        }

        const result = await RarityModel.findOne({
          collectionId: req.params.collectionId,
        });
        console.log("rarities: ", result);
        return res.status(200).json({
          success: true,
          rarities: result.rarities,
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
  .route("/statistics/:collectionId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const collection = await collectionModel.findById(
          req.params.collectionId
        );
        if (!collection) {
          return res.status(400).json({
            success: false,
            message: "Collection not found against this collectionId.",
          });
        }

        let data = {
          totalNFTs: collection.nftId.length,
          royaltyFee: collection.royaltyFee,
          createdAt: collection.createdAt,
        };

        if (collection.nftId.length != 0) {
          const distinctNFTOwners = await NftModel.find({
            _id: {
              $in: collection.nftId,
            },
          }).distinct("ownerId");

          const listings = await NftModel.find({
            _id: {
              $in: collection.nftId,
            },
          })
            .populate({
              path: "currentOrderListingId",
              select: "-_id price",
            })
            .select("-_id currentOrderListingId");

          const highestBids = await BidModel.find({
            nftId: {
              $in: collection.nftId,
            },
            isHighestBid: true,
          }).select("bidAmount -_id");

          data["uniqueOwners"] = distinctNFTOwners.length;

          let uniqueOwnership = data.uniqueOwners / collection.nftId.length;
          uniqueOwnership = Math.round(uniqueOwnership);
          data["uniqueOwnership"] = uniqueOwnership;

          if (listings[0].currentOrderListingId != undefined) {
            const prices = [];
            let listingsCount = 0;
            for (let i = 0; i < listings.length; ++i) {
              if (listings[i].currentOrderListingId != undefined) {
                prices[listingsCount] = listings[i].currentOrderListingId.price;
                ++listingsCount;
              }
            }

            let floorPrice = Math.min(...prices);
            floorPrice = Web3.utils.toBN(floorPrice).toString();
            floorPrice = Web3.utils.fromWei(floorPrice, "ether");

            let volume = BigNumber(BigNumber.sum.apply(null, prices));
            volume = Web3.utils.toBN(volume).toString();
            volume = Web3.utils.fromWei(volume, "ether");

            data["listingsCount"] = listingsCount;
            data["volume"] = volume;
            data["floorPrice"] = floorPrice;
          }

          if (highestBids.length != 0) {
            let bestOffer = Math.max.apply(
              Math,
              highestBids.map((bids) => {
                return bids.bidAmount;
              })
            );
            bestOffer = Web3.utils.toBN(bestOffer).toString();
            bestOffer = Web3.utils.fromWei(bestOffer, "ether");
            data["bestOffer"] = bestOffer;
          }
          // data = {...data, ...nayaData}
        }

        return res.status(200).json({
          success: true,
          data,
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

assetRouter.route("/approve").put(
  auth.verifyToken,
  verifyUser,
  auth.checkIsInRole("user", "admin"),

  async function (req, res, next) {
    try {
      const requiredAttributes = ["factoryType", "collectionId"];

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

      const factories = ["auction", "fixed-price"];
      const factoryType = req.body.factoryType;

      if (factories.indexOf(factoryType) == -1) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid factoryType sent, request factoryType does not exist!",
        });
      }

      const collection = await collectionModel.findById(req.body.collectionId);
      if (!collection) {
        return res.status(404).json({
          success: false,
          message: "This collection does not exists",
        });
      }

      if (
        factoryType === "auction" &&
        collection.isAuctionDropVerified == true
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This collection has already been approved by auction factory",
        });
      } else if (
        factoryType === "fixed-price" &&
        collection.isFixedPriceDropVerified == true
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This collection has already been approved by fixed-price factory",
        });
      }

      if (factoryType === "auction") {
        await collection.updateOne({ isAuctionDropVerified: true });
      } else {
        await collection.updateOne({ isFixedPriceDropVerified: true });
      }

      return res.status(200).json({
        success: true,
        message: "Collection verified successfully!",
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

assetRouter.route("/:collectionId").put(
  auth.verifyToken,
  verifyUser,
  auth.checkIsInRole("user", "admin"),
  fileManager.uploadDocument.single("thumbnail"),

  async function (req, res, next) {
    try {
      const requestParams = ["collectionId"];

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
      // var result = await UserModel.findOne({
      // 	email: req.user.email,
      // });
      // console.log("result : ", result);

      // if (!result) {
      // 	return res.status(400).json({
      // 		success: false,
      // 		message: "user don't exist against this walletAddress",
      // 	});
      // }
      var collectionData = await collectionModel.findOne({
        _id: req.params.collectionId,
      });
      if (!collectionData) {
        return res.status(400).json({
          success: false,
          message: "This collection does not exists",
        });
      }

      let uploadImage, newDescription;
      if (req.file) {
        const s3 = new AWS.S3({
          accessKeyId: process.env.S3_ACCESS_ID,
          secretAccessKey: process.env.S3_ACCESS_SECRET,
        });

        const fileContent = fs.readFileSync(req.file.path);
        console.log("fileContent :", fileContent);

        uploadImage = await s3
          .upload({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: req.file.originalname,
            Body: fileContent,
            ACL: "public-read",
          })
          .promise();
      }
      if (req.body.description) {
        newDescription = req.body.description;
      }

      let updatedData = {};

      if (uploadImage && newDescription) {
        updatedData.thumbnail = uploadImage.Location;
        updatedData.description = newDescription;
      } else if (uploadImage) {
        updatedData.thumbnail = uploadImage.Location;
      } else if (newDescription) {
        updatedData.description = newDescription;
      }

      const updateCollection = await collectionData.updateOne(updatedData);

      let message = "Collection Updated successfully!";

      if (updateCollection.modifiedCount === 0)
        message = "No modifcations made, same data sent again!";

      return res.status(200).json({
        success: true,
        message,
        updates: updateCollection.modifiedCount,
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

assetRouter.route("/txHash/:collectionId").put(
  auth.verifyToken,
  verifyUser,
  auth.checkIsInRole("user", "admin"),

  async function (req, res, next) {
    try {
      const requestParams = ["collectionId"];
      const requestBody = ["txHash"];

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
      // var result = await UserModel.findOne({
      //   email: req.user.email,
      // });
      // console.log("result : ", result);

      // if (!result) {
      //   return res.status(400).json({
      //     success: false,
      //     message: "user don't exist against this walletAddress",
      //   });
      // }
      var collectionData = await collectionModel.findOne({
        _id: req.params.collectionId,
      });
      if (!collectionData) {
        return res.status(400).json({
          success: false,
          message: "This collection does not exists",
        });
      }

      const updateCollection = await collectionData.updateOne({
        txHash: req.body.txHash,
      });

      let message = "Collection Updated successfully!";

      if (updateCollection.modifiedCount === 0)
        message = "No modifcations made, same txHash sent again!";

      return res.status(200).json({
        success: true,
        message,
        updates: updateCollection.modifiedCount,
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
  .route("/my-collections/:collectionType")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const marketplace = await getMarketplace(req.query.marketplaceId)
        if (!marketplace.success) {
          return res.status(400).json(marketplace)
        }
        const contractType =
          collectionModel.schema.path("contractType").enumValues;
        console.log("contractType: ", contractType);

        if (contractType.indexOf(req.params.collectionType) == -1) {
          return res.status(400).json({
            success: false,
            message:
              "Requested contractType is not present in collection schema",
          });
        }

        var collectionResult = await collectionModel.find({
          userId: req.user._id,
          contractType: req.params.collectionType,
          marketplaceId: req.query.marketplaceId
          // $or:[
          // 	{ isAuctionDropVerified: true},
          // 	{ isFixedPriceDropVerified: true}
          // ]
        }).populate({
          path: "categoryId",
          select: "name",
        });

        return res.status(200).json({
          success: true,
          collectionData: collectionResult,
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
  .route("/category/:categoryId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const marketplace = await getMarketplace(req.query.marketplaceId)
        if (!marketplace.success) {
          return res.status(400).json(marketplace)
        }

        const category = await CategoryModel.findById(req.params.categoryId)
        if (!category) {
          return res.status(404).json({
            success: false,
            message: "category not found",
          });
        }
  
        var collectionResult = await collectionModel.find({
          userId: req.user._id,
          categoryId: req.params.categoryId,
          marketplaceId: req.query.marketplaceId
        });

        return res.status(200).json({
          success: true,
          collectionData: collectionResult,
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
  .route("/my-collections/pending-verification/:collectionType/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const start = req.params.start;
        const end = req.params.end;

        const checkPagination = validatePaginationParams(start, end);
        if (checkPagination.success == false) {
          return res.status(400).json({
            success: false,
            message: checkPagination.message,
          });
        }

        const contractType =
          collectionModel.schema.path("contractType").enumValues;
        console.log("contractType: ", contractType);

        if (contractType.indexOf(req.params.collectionType) == -1) {
          return res.status(400).json({
            success: false,
            message:
              "Requested contractType is not present in collection schema",
          });
        }
        const marketplace = await getMarketplace(req.query.marketplaceId)
        if (!marketplace.success) {
          return res.status(400).json(marketplace)
        }

        const result = await collectionModel.find({
          userId: req.user._id,
          contractType: req.params.collectionType,
          marketplaceId: req.query.marketplaceId
          // $or:[
          // 	{ isAuctionDropVerified: false},
          // 	{ isFixedPriceDropVerified: false}
          // ]
        });

        const reverse = result.reverse();
        const paginatedResult = reverse.slice(start, end);

        return res.status(200).json({
          success: true,
          data: paginatedResult,
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
  .route("/my-collections/:start/:end")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        const requestParams = ["start", "end"];

        const missingAttribute = checkMissingAttributes(
          req.params,
          requestParams
        );
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: missingAttribute + " not found in request params!",
          });
        }
        const emptyAttributes = checkEmptyAttributes(req.params, requestParams);
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: emptyAttributes + " was empty in request params!",
          });
        }

        const checkPagination = validatePaginationParams(
          req.params.start,
          req.params.end
        );
        if (checkPagination.success == false) {
          return res.status(400).json({
            success: false,
            message: checkPagination.message,
          });
        }
        
        const marketplace = await getMarketplace(req.query.marketplaceId)
        if (!marketplace.success) {
          return res.status(400).json(marketplace)
        }

        var collectionResult1 = await collectionModel.find({
          userId: req.user._id,
          marketplaceId: req.query.marketplaceId
        }).populate({
          path: "categoryId",
          select: "name",
        });;

        console.log("collectionResult = ", collectionResult1);

        var collectionResult = collectionResult1.reverse();

        var paginationresult = collectionResult.slice(
          req.params.start,
          req.params.end
        );

        return res.status(200).json({
          success: true,
          collectionData: paginationresult,
          collectionCount: collectionResult.length,
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

// assetRouter
//   .route("/my-collections/:start/:end")
//   .get(
//     auth.verifyToken,
//     verifyUser,
//     auth.checkIsInRole("user", "admin"),
//     async function (req, res, next) {
//       try {
//         const requestParams = ["start", "end"];

//         const missingAttribute = checkMissingAttributes(
//           req.params,
//           requestParams
//         );
//         if (missingAttribute != null) {
//           return res.status(400).json({
//             success: false,
//             message: missingAttribute + " not found in request params!",
//           });
//         }
//         const emptyAttributes = checkEmptyAttributes(req.params, requestParams);
//         if (emptyAttributes != null) {
//           return res.status(400).json({
//             success: false,
//             message: emptyAttributes + " was empty in request params!",
//           });
//         }
//         const checkPagination = validatePaginationParams(
//           req.params.start,
//           req.params.end
//         );
//         if (checkPagination.success == false) {
//           return res.status(400).json({
//             success: false,
//             message: checkPagination.message,
//           });
//         }
       
//         const marketplace = await getMarketplace(req.query.marketplaceId)
//         if (!marketplace.success) {
//           return res.status(400).json(marketplace)
//         }

//         var collectionResult1 = await collectionModel.find({
//           userId: req.user._id,
//           marketplaceId: req.query.marketplaceId
//         });

//         console.log("collectionResult = ", collectionResult1);

//         var collectionResult = collectionResult1.reverse();

//         var paginationResult = collectionResult.slice(
//           req.params.start,
//           req.params.end
//         );

//         return res.status(200).json({
//           success: true,
//           collectionData: paginationResult,
//           collectionCount: collectionResult.length,
//         });
//       } catch (error) {
//         console.log("error (try-catch) : " + error);
//         return res.status(500).json({
//           success: false,
//           err: error,
//         });
//       }
//     }
//   );

assetRouter
  .route("/:collectionId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {
        if (!req.params.collectionId) {
          return res.status(400).json({
            success: false,
            message: "collectionId not found in the params",
          });
        }

        var collectionResult = await collectionModel.findOne({
          _id: req.params.collectionId,
        });
        console.log("collectionResult = ", collectionResult);

        if (!collectionResult) {
          return res.status(400).json({
            success: false,
            message: "Collection not found against this collectionId.",
          });
        }
        var data = [];
        for (var i = 0; i < collectionResult.nftId.length; i++) {
          console.log(
            "NftIds" + " at " + i + "index is = " + collectionResult.nftId[i]
          );
          var nftdata = await NftModel.find({ _id: collectionResult.nftId[i] });
          console.log("Nftdata" + " at " + i + "index is = " + nftdata);
          data.push(nftdata);
        }

        return res.status(200).json({
          success: true,
          collectionData: collectionResult,
          nftsdata: data,
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
  .route("/is-on-sale/:collectionId")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async function (req, res, next) {
      try {

        if (!req.params.collectionId) {
          return res.status(400).json({
            success: false,
            message: "collectionId not found in the params",
          });
        }

        let totalNFTsOnSale = 0;
        let isOnSale = false;
        let nftsData = await NftModel.find({ collectionId: req.params.collectionId});

        for (var i = 0; i < nftsData.length; i++) {
          
          if(nftsData[i].isOnSale){
            totalNFTsOnSale ++;
            isOnSale = true;
          }
        }

        return res.status(200).json({
          success: true,
          isOnSale,
          totalNFTs: nftsData.length,
          totalNFTsOnSale
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


module.exports = assetRouter;
