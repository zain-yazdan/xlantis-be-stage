const UserModel = require("../../../models/UserModel");

const checkDomain = async (req, res) => {
      try {
        if(req.query.domain == undefined){
          return res.status(400).json({
            success: false,
            message: "Domain not found in request body."
          })
        }
        if(req.query.domain == ""){
          return res.status(400).json({
            success: false,
            message: "Domain found empty in request body."
          })
        }
        const domain = await UserModel.findOne({domain: req.query.domain});
        let response = {success : true}

        if(domain){
          response.exists = true;
          response.message = "Domain already exists.";
        }
        else{
          response.exists = false;
          response.message = "Domain does not exists."
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

module.exports = {
    checkDomain
};