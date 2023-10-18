var express = require("express");
var router = express.Router();

const auth = require("../../middlewares/auth");
const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});

const PlatformFeeRequests = require("../../models/PlatformFeeModel");

const { checkNull, validatePlatformFee } = require("../utils/validateRequest");
const { getOneByFilter } = require("../utils/database-query");

router
  .route("/admin")
  .post(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin"),
    async function (req, res, next) {
      try {
        const result = validatePlatformFee(req.body.platformFee);

        if (!result.success) {
          return res.status(400).json(result);
        }

        await PlatformFeeRequests.create({
          userId: req.user._id,
          platformFee: req.body.platformFee,
        });

        return res.status(200).json({
          success: true,
          message: "Platform fee request successfully made.",
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
	.route("/super-admin")
	.post(
		auth.verifyToken,
		verifyUser,
		auth.checkIsInRole("super-admin"),
		async function (req, res, next) {
			try {
				const result = validatePlatformFee(req.body.platformFee)

				if(!result.success){
					return res.status(400).json(result);					
				}

				await PlatformFeeRequests.updateOne({
					userId: req.user._id,
					isAccepted: "accepted"
				},{
					isAccepted: "expired"
				});


				await PlatformFeeRequests.create({
					userId: req.user._id,
					platformFee: req.body.platformFee,
					isAccepted: "accepted"
				})
                
				return res.status(200).json({
					success: true,
					message: "Platform fee set up successfully.",
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
	.route("/super-admin")
	.post(
		auth.verifyToken,
		verifyUser,
		auth.checkIsInRole("super-admin"),
		async function (req, res, next) {
			try {
				const result = validatePlatformFee(req.body.platformFee)

				if(!result.success){
					return res.status(400).json(result);					
				}

				await PlatformFeeRequests.updateOne({
					userId: req.user._id,
					isAccepted: "accepted"
				},{
					isAccepted: "expired"
				});


				await PlatformFeeRequests.create({
					userId: req.user._id,
					platformFee: req.body.platformFee,
					isAccepted: "accepted"
				})
                
				return res.status(200).json({
					success: true,
					message: "Platform fee set up successfully.",
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
  .route("/super-admin/accept")
  .patch(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        const result = checkNull("Platform fee Id", req.body.platformFeeId);

        if (!result.success) {
          return res.status(400).json(result);
        }

        let fee = await getOneByFilter(
          "Platform fee request",
          PlatformFeeRequests,
          {
            _id: req.body.platformFeeId,
          }
        );
        if (!fee.success) {
          return res.status(400).json(fee);
        }

        await PlatformFeeRequests.updateOne(
          {
            userId: fee.document.userId,
            isAccepted: "accepted",
          },
          {
            isAccepted: "expired",
          }
        );

        await fee.document.updateOne({
          isAccepted: "accepted",
        });

        return res.status(200).json({
          success: true,
          message: "Platform fee successfully updated for the admin.",
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
  .route("/super-admin/reject")
  .patch(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("super-admin"),
    async function (req, res, next) {
      try {
        const result = checkNull("Platform fee Id", req.body.platformFeeId);

        if (!result.success) {
          return res.status(400).json(result);
        }

        let fee = await getOneByFilter(
          "Platform fee request",
          PlatformFeeRequests,
          {
            _id: req.body.platformFeeId,
          }
        );
        if (!fee.success) {
          return res.status(400).json(fee);
        }

        await fee.document.updateOne({
          isAccepted: "rejected",
        });
        return res.status(200).json({
          success: true,
          message: "Platform fee rejected.",
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
  .route("/admin/status")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("admin", "super-admin"),
    async function (req, res, next) {
      try {
        const result = checkNull("Platform fee Status", req.query.status);

        if (!result.success) {
          return res.status(400).json(result);
        }

        const status = PlatformFeeRequests.schema.path("isAccepted").enumValues;
        if (status.indexOf(req.query.status) == -1) {
          return res.status(400).json({
            success: false,
            message: "Invalid status of the request.",
          });
        }
        let fee = await PlatformFeeRequests.find({
          isAccepted: req.query.status,
        });

        return res.status(200).json({
          success: true,
          PlatformFee: fee,
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
	.route("/my-fee/status")
	.get(
		auth.verifyToken,
		verifyUser,
		auth.checkIsInRole("admin","super-admin"),
		async function (req, res, next) {
			try {
				const result = checkNull('Platform fee Status', req.query.status);

				if(!result.success){
					return res.status(400).json(result)
				}
				
				const status = PlatformFeeRequests.schema.path("isAccepted").enumValues;
				if(status.indexOf(req.query.status) == -1){
					return res.status(400).json({
						success: false,
						message: "Invalid status of the request."
					})
				}
				let fee = await PlatformFeeRequests.find({
					userId: req.user._id,
					isAccepted: req.query.status
				})
              
				return res.status(200).json({
					success: true,
					PlatformFee: fee
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

module.exports = router;
