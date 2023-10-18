var express = require("express");
var router = express.Router();

const auth = require("../../middlewares/auth");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});

const fs = require("fs");
const AWS = require("aws-sdk");

const CategoryModel = require("../../models/CategoryModel");

const fileManager = require("../../actions/fileManager");

router
  .route("/")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin"),
    fileManager.uploadDocument.single("image"),
    async function (req, res, next) {
      try {
        if(req.body.name == undefined){
          return res.status(400).json({
            success: false,
            message: "Name not found in request body."
          })
        }
        if(req.body.name == ""){
          return res.status(400).json({
            success: false,
            message: "Name found empty in request body."
          })
        }
        if(req.file == undefined){
          return res.status(400).json({
            success: false,
            message: "Image not found in request file."
          })
        }
        
        const s3 = new AWS.S3({
          accessKeyId: process.env.S3_ACCESS_ID,
          secretAccessKey: process.env.S3_ACCESS_SECRET,
        });
        const fileContentThumbnail = fs.readFileSync(req.file.path);
        console.log("fileContentThumbnail :", fileContentThumbnail);

        const uploadImage = await s3
          .upload({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: req.file.originalname,
            Body: fileContentThumbnail,
            ACL: "public-read",
          })
          .promise();
       
          await CategoryModel.create({
            name: req.body.name,
            imageUrl: uploadImage.Location
          });

        return res.status(200).json({
          success: true,
          message: "Category added successfully.",
        });
      } catch (error) {
        console.log("catch-error : ", error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    }
  );

router
  .route("/:categoryId")
  .put(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin"),
    fileManager.uploadDocument.single("image"),
    async function (req, res, next) {
      try {

        if(req.params.categoryId == undefined){
          return res.status(400).json({
            success: false,
            message: "Category Name not found in request body."
          })
        }
        if(req.params.categoryId == ""){
          return res.status(400).json({
            success: false,
            message: "Category Name found empty in request body."
          })
        }

        const category = await CategoryModel.findById(req.params.categoryId)

        if(!category){
          return res.status(400).json({
            success: false,
            message: "No category found against provided category name."
          })
        }

        let updates = {};
        if(req.body.name !== undefined && req.body.name !== ""){
          updates.name = req.body.name;
        }
      
        if(req.file !== undefined){
          const s3 = new AWS.S3({
            accessKeyId: process.env.S3_ACCESS_ID,
            secretAccessKey: process.env.S3_ACCESS_SECRET,
          });

          const deletedImage = await s3
          .deleteObject({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: category.imageUrl,
          })

          console.log("Deleted Image : ", deletedImage);

          const fileContentThumbnail = fs.readFileSync(req.file.path);
          console.log("fileContentThumbnail :", fileContentThumbnail);

          const uploadImage = await s3
            .upload({
              Bucket: process.env.S3_BUCKET_NAME,
              Key: req.file.originalname,
              Body: fileContentThumbnail,
              ACL: "public-read",
            })
            .promise();
            updates.imageUrl = uploadImage.Location;
        }
        
        const updateReport = await category.updateOne(updates);

        console.log("Update Report : ", updateReport)

        return res.status(200).json({
          success: true,
          message: "Category updated successfully.",
        });
      } catch (error) {
        console.log("catch-error : ", error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    }
  );

router
  .route("/")
  .get(
    async function (req, res, next) {
      try {

        const categories = await CategoryModel.find();

        return res.status(200).json({
          success: true,
          categories,
        });
      } catch (error) {
        console.log("catch-error : ", error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    }
  );

router
  .route("/is-available")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin"),
    async function (req, res, next){
      try {
        if(req.query.categoryName == undefined){
          return res.status(400).json({
            success: false,
            message: "Category Name not found in request query."
          })
        }
        if(req.query.categoryName == ""){
          return res.status(400).json({
            success: false,
            message: "Category Name found empty in request query."
          })
        }
        const category = await CategoryModel.findOne({name: req.query.categoryName});
        let response = {success : true}

        if(category){
          response.isAvailable = false;
          response.message = "Category already exists.";
        }
        else{
          response.isAvailable = true;
          response.message = "Category does not exists."
        }
        return res.status(200).json(response);
      } catch (error) {
        console.log("error (try-catch) : " + error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    });

module.exports = router;
