var express = require("express");
var assetRouter = express.Router();
require("dotenv").config();
const multer = require("multer");
const upload = multer({ dest: "public/uploads" });

const auth = require("../../middlewares/auth");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});
const pinataSDK = require("@pinata/sdk");
const pinata = new pinataSDK(
  process.env.PINATA_API_KEY,
  process.env.PINATA_API_SECRET
);
const axios = require("axios");
const FormData = require("form-data");
const JWT = process.env.PINATA_API_JWT;
const fileManager = require("../../actions/fileManager");

const fs = require("fs");
const AWS = require("aws-sdk");

assetRouter
  .route("/image")
  .post(
    auth.verifyToken,
    verifyUser,
    upload.single("image"),
    async function (req, res, next) {
      try {
        console.log("image :", req.file);
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "image not found in the request files",
          });
        }

        const formData = new FormData();
        const src = req.file.path;
        const file = fs.createReadStream(src);
        formData.append("file", file);
        const metadata = JSON.stringify({
          name: req.file.filename,
        });
        formData.append("pinataMetadata", metadata);
        const options = JSON.stringify({
          cidVersion: 0,
        });
        formData.append("pinataOptions", options);

        const pinataResponse = await axios.post(
          process.env.PINATA_API_URL,
          formData,
          {
            maxBodyLength: "Infinity",
            headers: {
              "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
              Authorization: JWT,
            },
          }
        );
        console.log("Data : ", pinataResponse.data);

        return res.status(200).json({
          success: true,
          message: "File uploaded successfully",
          IpfsData: pinataResponse.data,
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
