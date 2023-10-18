require("dotenv").config();

const {
  checkMissingAttributes,
  checkEmptyAttributes,
} = require("../../../utils/request-body");

const NFTPropertiesModel = require("../../../models/NFTPropertiesModel");

const createTemplate = async (req, res) => {
  try {
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
    if (req.body.name == undefined) {
      return res.status(400).json({
        success: false,
        message: "name not found in request body",
      });
    }
    if (req.body.name === "") {
      return res.status(400).json({
        success: false,
        message: "name was empty in request body",
      });
    }
    // const user = await UserModel.findOne({
    // 	walletAddress: req.user.walletAddress,
    // });

    // let properties = [];
    // for (let i = 0; i < req.body.data.length; i++) {
    // 	properties[i] = {
    // 		key: req.body.data[i].key,
    // 		// value: req.body.data[i].value,
    // 		type: req.body.data[i].type,
    // 	};
    // }
    let templateToCreate = {
      adminId: req.user._id,
      name: req.body.name,
      properties: req.body.data,
      userType: "super-admin",
    };
    // templateToCreate["name"] = req.body.name;
    // templateToCreate["properties"] = properties;
    templateToCreate = new NFTPropertiesModel(templateToCreate);

    console.log("Template: " + templateToCreate);
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
};

const createAdminTemplate = async (req, res) => {
  try {
    let requiredAttributes = ["key", "type"];
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

    requiredAttributes = ["isDefault", "name"];

    missingAttribute = checkMissingAttributes(req.body, requiredAttributes);

    if (missingAttribute != null) {
      return res.status(400).json({
        success: false,
        message: `${missingAttribute} not found in request body!`,
      });
    }

    emptyAttributes = checkEmptyAttributes(req.body, requiredAttributes);
    if (emptyAttributes != null) {
      return res.status(400).json({
        success: false,
        message: `${emptyAttributes} was empty in request body!`,
      });
    }

    if (req.body.isDefault !== true && req.body.isDefault !== false) {
      return res.status(400).json({
        success: false,
        message: "isDefault value must be boolean.",
      });
    }
    // let properties = [];
    // for (let i = 0; i < req.body.data.length; i++) {
    // 	properties[i] = {
    // 		key: req.body.data[i].key,
    // 		// value: req.body.data[i].value,
    // 		type: req.body.data[i].type,
    // 	};
    // }
    let templateToCreate = {
      adminId: req.user._id,
      name: req.body.name,
      properties: req.body.data,
      isDefault: req.body.isDefault,
      userType: "admin",
    };
    if (req.body.isDefault == true) {
      await NFTPropertiesModel.updateOne(
        {
          adminId: req.user._id,
          isDefault: true,
        },
        {
          isDefault: false,
        }
      );
    }
    // templateToCreate["name"] = req.body.name;
    // templateToCreate["properties"] = properties;
    templateToCreate = new NFTPropertiesModel(templateToCreate);

    console.log("Template: " + templateToCreate);
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
};

const getAdminTemplate = async (req, res) => {
  try {
    const templates = await NFTPropertiesModel.find({
      adminId: req.user._id,
    });

    return res.status(200).json({
      success: true,
      templates: templates,
      // message: "Template created successfully.",
    });
  } catch (error) {
    console.log("try-catch error: " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};

const getTemplates = async (req, res) => {
  try {
    // let result = await UserModel.findOne({
    // 		walletAddress: req.user.walletAddress,
    // 	});
    // console.log("result : ", result);

    // if (!result) {
    // 	return res.status(404).json({
    // 		success: false,
    // 		message: "user dont exist against this walletAddress",
    // 	});
    // }
    const templates = await NFTPropertiesModel.find();

    return res.status(200).json({
      success: true,
      templates: templates,
      // message: "Template created successfully.",
    });
  } catch (error) {
    console.log("try-catch error: " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};

const getTemplatesFromStartToEnd = async (req, res) => {
  try {
    // let result = await UserModel.findOne({
    // 	walletAddress: req.user.walletAddress,
    // });

    // console.log("result : ", result);

    // if (!result) {
    // 	return res.status(404).json({
    // 		success: false,
    // 		message: "user dont exist against this walletAddress",
    // 	});
    // }

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

    const templates = await NFTPropertiesModel.find();

    let paginationResult = templates.slice(req.params.start, req.params.end);
    return res.status(200).json({
      success: true,
      templates: paginationResult,
      // message: "Template created successfully.",
    });
  } catch (error) {
    console.log("try-catch error: " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};

const getTemplateById = async (req, res) => {
  try {
    const requiredAttributes = ["key", "value"];
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
    if (req.params.id == undefined) {
      return res.status(400).json({
        success: false,
        message: "id not found in request params",
      });
    }
    if (req.paras.id === "") {
      return res.status(400).json({
        success: false,
        message: "id was empty in request params",
      });
    }
    const template = await NFTPropertiesModel.findOne(req.params.id);
    if (!template) {
      return res.status(400).json({
        success: false,
        message: "Template not found.",
      });
    }

    for (let i = 0; i < req.body.data.length; i++) {
      if (template.properties[i].key == req.body.data[i].key) {
      }
    }

    return res.status(200).json({
      success: true,
      template: template,
      // message: "Template created successfully.",
    });
  } catch (error) {
    console.log("try-catch error: " + error);
    return res.status(500).json({
      success: false,
      err: error,
    });
  }
};

module.exports = {
  createTemplate,
  createAdminTemplate,
  getAdminTemplate,
  getTemplates,
  getTemplatesFromStartToEnd,
  getTemplateById,
};
