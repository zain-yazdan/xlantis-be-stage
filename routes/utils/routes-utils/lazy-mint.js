require("dotenv").config();

const { generateUint256Id } = require("../../../utils/blockchain");
const Web3 = require("web3");
const {
  checkMissingAttributes,
  checkEmptyAttributes,
  constructObject,
} = require("../../../utils/request-body");
const { calculateRarity } = require("../../../utils/open-rarity");

const NFTModel = require("../../../models/NFTModel");
const RarityModel = require("../../../models/RarityModel");
const { getCollectionById } = require("../collections");
const { getNFTById } = require("../nft");

const lazyMintNFT = async (req, res) => {
  try {
    const REQUIRED_FIELDS = [
      "title",
      "collectionId",
      "nftFormat",
      "nftURI",
      "metadataURI",
    ];
    const ALL_POSSIBLE_FIELDS = [
      "title",
      "description",
      "type",
      "properties",
      "collectionId",
      "nftURI",
      "previewImageURI",
      "nftFormat",
      "metadataURI",
      "tokenSupply",
    ];
    const IMAGE_FORMATS = JSON.parse(process.env.IMAGE_NFT_FORMATS_SUPPORTED);
    const NFT_FORMATS = JSON.parse(process.env.NFT_FORMATS_SUPPORTED);

    const missingField = checkMissingAttributes(req.body, REQUIRED_FIELDS);
    if (missingField != null) {
      return res.status(400).json({
        success: false,
        message: `${missingField} was not found in request body`,
      });
    }

    const emptyField = checkEmptyAttributes(req.body, REQUIRED_FIELDS);
    if (emptyField != null) {
      return res.status(400).json({
        success: false,
        message: `${emptyField} was empty in request body`,
      });
    }

    const format = req.body.nftFormat;

    if (IMAGE_FORMATS.indexOf(format) === -1) {
      REQUIRED_FIELDS.push("previewImageURI");
      ALL_POSSIBLE_FIELDS.push("previewImageURI");
    }

    if (NFT_FORMATS.indexOf(format) === -1) {
      return res.status(400).json({
        success: false,
        message: "NFT format is not currently supported",
      });
    }

    // const user = await UserModel.findOne({
    // 	email: req.user.email,
    // });

    const collectionResult = await getCollectionById(req.body.collectionId);
    if (!collectionResult.success) {
      return res.status(404).json({
        success: false,
        message: collectionResult.message,
      });
    }

    const NFT = constructObject(req.body, ALL_POSSIBLE_FIELDS);
    NFT["minterId"] = req.user._id;
    NFT["ownerId"] = req.user._id;
    NFT["mintingType"] = "lazy-mint";

    const randomId = generateUint256Id();
    NFT["nftId"] = randomId;

    const NFTs = await NFTModel.find({
      _id: { $in: collectionResult.collection.nftId },
    }).select("properties");

    const result = await NFTModel.create(NFT);
    console.log({ result });

    collectionResult.collection.nftId.push(result._id);
    await collectionResult.collection.save();

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

        await RarityModel.create({
          collectionId: req.body.collectionId,
          rarities: rarities,
        });
      }
    }

    return res.status(200).json({
      success: true,
      nftId: randomId,
      nftObjectId: result._id,
      message: "NFT added successfully",
    });
  } catch (error) {
    console.log("error (try-catch) : " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};

const createVoucher = async (req, res) => {
  try {
    const REQUIRED_FIELDS = ["signature", "nftId"];

    const missingField = checkMissingAttributes(req.body, REQUIRED_FIELDS);
    if (missingField != null) {
      return res.status(400).json({
        success: false,
        message: `${missingField} was not found in request body`,
      });
    }
    const emptyField = checkEmptyAttributes(req.body, REQUIRED_FIELDS);
    if (emptyField != null) {
      return res.status(400).json({
        success: false,
        message: `${emptyField} was empty in request body`,
      });
    }

    if (!Web3.utils.isHexStrict(req.body.signature)) {
      return res.status(400).json({
        success: false,
        message: "Invalid signature sent, it must be a strict hex number",
      });
    }

    const nftResult = await getNFTById(req.body.nftId);
    if (!nftResult.success) {
      return res.status(404).json({
        success: false,
        message: nftResult.message,
      });
    }

    const report = await nftResult.NFT.updateOne({
      voucherSignature: req.body.signature,
    });

    console.log({ report });

    return res.status(200).json({
      success: true,
      message: "voucher signature added successfully",
    });
  } catch (error) {
    console.log("error (try-catch) : " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};

module.exports = { lazyMintNFT, createVoucher };
