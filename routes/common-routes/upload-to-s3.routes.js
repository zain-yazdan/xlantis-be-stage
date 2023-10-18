var express = require("express");
var assetRouter = express.Router();
require("dotenv").config();

const auth = require("../../middlewares/auth");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});

const fileManager = require("../../actions/fileManager");

const fs = require("fs");
const AWS = require("aws-sdk");

assetRouter.route("/image").post(
  auth.verifyToken,
  verifyUser,
  fileManager.uploadDocument.fields([
    {
      name: "image",
      maxCount: 1,
    },
  ]),
  async function (req, res, next) {
    try {
      // var result = await UserModel.findOne({
      //    email: req.user.email
      //  });
      //  console.log("result : ", result);

      //  if(!result)
      //  {
      //         return res.status(400).json({
      //        success: false,
      //        message: "user dont exist against this walletAddress",

      //        });
      //  }
      console.log("image :", req.files.image);
      if (!req.files.image) {
        return res.status(400).json({
          success: false,
          message: "image not found in the request files",
        });
      }

      // Enter copied or downloaded access ID and secret key here
      const ID = process.env.S3_ACCESS_ID;
      const SECRET = process.env.S3_ACCESS_SECRET;

      // The name of the bucket that you have created
      const BUCKET_NAME = process.env.S3_BUCKET_NAME;

      const s3 = new AWS.S3({
        accessKeyId: ID,
        secretAccessKey: SECRET,
      });

      // read content from the file
      const fileContent = fs.readFileSync(req.files.image[0].path);
      console.log("fileContent :", fileContent);
      console.log("File Name: ",req.files.image[0].originalname);
      let index = req.files.image[0].originalname.indexOf(".");
      let fileName = req.files.image[0].originalname.slice(0, index) + "-" + Date.now() + req.files.image[0].originalname.slice(index);
      console.log("Appended Filename : ", fileName)
      // Setting up S3 upload parameters
      const params = {
        Bucket: BUCKET_NAME,
        Key: fileName, // File name you want to save as in S3
        Body: fileContent,
        ACL: "public-read",
        ContentType: req.files.image[0].mimetype,
      };

      // Uploading files to the bucket
      s3.upload(params, function (err, data) {
        if (err) {
          throw err;
        }
        console.log(`File uploaded successfully. ${data.Location}`);
        return res.status(200).json({
          success: true,
          message: "File uploaded successfully",
          url: `${data.Location}`,
        });
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
