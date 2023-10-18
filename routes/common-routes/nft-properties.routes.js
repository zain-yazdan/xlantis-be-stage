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
} = require("../../utils/request-body");
const {
  getCountByFilter,
  getAllByFilter,
  getOneByFilter,
} = require("../utils/database-query");

const { checkNull } = require("../utils/validateRequest");

const {
  createTemplate,
  createAdminTemplate,
  getAdminTemplate,
  getTemplates,
  getTemplatesFromStartToEnd,
} = require("../utils/routes-utils/nft-properties");
const NFTPropertiesModel = require("../../models/NFTPropertiesModel");
const Users = require("../../models/UserModel");

assetRouter
  .route("/template")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin", "admin"),
    async function (req, res, next) {
      try {
        let requiredAttributes = ["key", "type"];
        let missingAttribute, emptyAttributes;
        result = checkNull("Data array", req.body.data);
        if (!result.success) {
          return res.status(400).json(result);
        }
        for (let i = 0; i < req.body.data.length; i++) {
          missingAttribute = checkMissingAttributes(
            req.body.data[i],
            requiredAttributes
          );

          if (missingAttribute != null) {
            return res.status(400).json({
              success: false,
              message: `${missingAttribute} not found in request body of Key number: ${
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
              message: `${emptyAttributes} was empty in request body of Key number: ${
                i + 1
              }!`,
            });
          }
        }
    
        const user = await Users.findById(req.user._id);
        requiredAttributes = ["name"];
        if (user.role == 'admin') requiredAttributes.push("isDefault")

        missingAttribute = checkMissingAttributes(req.body, requiredAttributes);
        if (missingAttribute != null) {
          return res.status(400).json({
            success: false,
            message: `${missingAttribute} not found in request body`,
          });
        }

        emptyAttributes = checkEmptyAttributes(req.body, requiredAttributes);
        if (emptyAttributes != null) {
          return res.status(400).json({
            success: false,
            message: `${emptyAttributes} was empty in request body`,
          });
        }

        const isTemplatePresent = await NFTPropertiesModel.findOne({
          name: req.body.name,
          adminId: req.user._id
        })
        if (isTemplatePresent) {
          return res.status(400).json({
            success: false,
            message: `template name must be unique across an admin`
          })
        }

        if (user.role == 'admin' && req.body.isDefault == true ) {
          const filter = { isDefault: true, userType: user.role }
          await NFTPropertiesModel.updateOne(filter, { isDefault: false });
        }
        
        let templateToCreate = {
          adminId: req.user._id,
          name: req.body.name,
          properties: req.body.data,
          userType: user.role,
          isDefault: req.body.isDefault || false
        };
        await NFTPropertiesModel.create(templateToCreate);

        return res.status(200).json({
          success: true,
          message: "Template created successfully.",
        });
      } catch (error) {
        console.log("try-catch error: " + error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    }
  );

assetRouter
  .route("/template/:templateId")
  .put(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin", "admin"),
    async function (req, res, next) {
      try {
        let template = await getOneByFilter(
          "",
          NFTPropertiesModel,
          {
            _id: req.params.templateId,
          },
          "Template not found against given ID."
        );

        if (!template.success) {
          return res.status(400).json(template);
        }
        if (template.document.adminId != req.user._id.toString()) {
          return res.status(400).json({
            success: false,
            message: "User is not authorized to update this template",
          });
        }

        let templateToUpdate = {};
        if (req.body.name != undefined && req.body.name != "") {
          templateToUpdate["name"] = req.body.name;
          const user = await Users.findById(req.user._id);
          const isTemplatePresent = await NFTPropertiesModel.findOne({
            name: req.body.name,
            adminId: user._id,
          })
          if (isTemplatePresent) {
            return res.status(400).json({
              success: false,
              message: `template name must be unique across an admin`
            })
          }  
        }
        if(req.body.data != undefined && req.body.data.length == 0){
          return res.status(400).json({
            success: false,
            message: "No key value pairs found in request body."
          })
        }
        // if (req.body.data != undefined && req.body.data.length > 0) 
        else if (req.body.data != undefined){
          const requiredAttributes = ["key", "type"];
          let missingAttribute, emptyAttributes;
          for (let i = 0; i < req.body.data.length; i++) {
            missingAttribute = checkMissingAttributes(
              req.body.data[i],
              requiredAttributes
            );

            if (missingAttribute != null) {
              return res.status(400).json({
                success: false,
                message: `${missingAttribute} not found in request body of Key number: ${
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
                message: `${emptyAttributes} was empty in request body of Key number: ${
                  i + 1
                }!`,
              });
            }
          }
          templateToUpdate["properties"] = req.body.data;
        }

        await template.document.updateOne(templateToUpdate);

        return res.status(200).json({
          success: true,
          message: "Template updated successfully.",
        });
      } catch (error) {
        console.log("try-catch error: " + error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    }
  );

assetRouter
  .route("/template/:templateId")
  .delete(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin", "admin"),
    async function (req, res, next) {
      try {
        const template = await NFTPropertiesModel.findById(req.params.templateId)
        if (!template) {
          return res.status(400).json({
            success: false, 
            message: "template not found",
          })
        }
        if (template.adminId != req.user._id.toString()) {
          return res.status(400).json({
            success: false,
            message: "User is not authorized to delete this template",
          });
        }

        await template.delete();

        return res.status(200).json({
          success: true,
          message: "template deleted",
        });
      } catch (error) {
        console.log("try-catch error: " + error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    }
  );

assetRouter
  .route("/admin/default")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin"),
    async function (req, res, next) {
      try {
        const templates = await NFTPropertiesModel.findOne({
          adminId: req.user._id,
          isDefault: true,
        });
        return res.status(200).json({
          success: true,
          defaultTemplate: templates,
        });
      } catch (error) {
        console.log("try-catch error: " + error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    }
  );

assetRouter
  .route("/template/is-available/:templateName")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin", "super-admin"),
    async function (req, res, next) {
      try {
        const template = await NFTPropertiesModel.findOne({
          adminId: req.user._id,
          // userType: req.params.userType,
          name: req.params.templateName,
        });
        let isAvailable = template ? true : false;

        return res.status(200).json({
          success: true,
          isAvailable,
        });
      } catch (error) {
        console.log("try-catch error: " + error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    }
  );

// assetRouter
//   .route("/admin/")
//   .get(
//     auth.verifyToken,
//     verifyUser,
//     auth.checkIsInRole("admin", "user"),
//     async function (req, res, next) {
//       return await getAdminTemplate(req, res);
//     }
//   );

assetRouter
  .route("/:userType")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin", "super-admin"),
    async function (req, res, next) {
      try {
        const requiredAttributes = ["userType"];

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
        const status = NFTPropertiesModel.schema.path("userType").enumValues;
        if (status.indexOf(req.params.userType) == -1) {
          return res.status(400).json({
            success: false,
            message: "Invalid value of user type.",
          });
        }

        const filter = { userType: req.params.userType }
        if (req.params.userType == 'admin') filter['adminId'] = req.user._id
        const templates = await NFTPropertiesModel.find(filter);

        return res.status(200).json({
          success: true,
          templates: templates,
        });
      } catch (error) {
        console.log("try-catch error: " + error);
        return res.status(500).json({
          success: false,
          err: error,
        });
      }
    }
  );

module.exports = assetRouter;
