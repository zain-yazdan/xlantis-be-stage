// const mongoose = require("mongoose");
// const forgotPasswordModel = require("../models/v1-sso/ForgotPasswordModel");
// const crypto = require("crypto");

// const transporter = require("../config/nodemailer")();

// let sendResetPasswordPin = async (email, method) => {
//   try {

//     var token;

//     token = crypto.randomBytes(2).toString("hex");

//     // console.log("token : " + token);

//     // if(method == "new")
//     // {

//     // }
//     // else if(method == "resend")
//     // {
//     //   let result = await ResetPassword.findOne({userEmail: email});

//     //   // console.log("result ResetPassword : " + result);

//     //   if(!result)
//     //     return false;

//     //   token = result.resetPasswordToken;

//     //   console.log("token : " + token);
//     //   // return true;
//     // }

//     let mailOptions = {
//       from: "support@proyectominga.com",
//       to: email,
//       subject: "Reset Password",
//       html:
//         "<h4><b>Reset Password</b></h4>" +
//         "<p>To reset your account password, enter pin :  <b>" + token +  "</b> </p> <br><br>" +
//         "Thanks<br>" +
//         "The Minga Project Team<br><br>" +
//         "12-39 Presidente Borreo<br>" +
//         "Cuenca, Ecuador 10107",
//     };

//     // send mail with defined transport object

//     let info = await transporter.sendMail(mailOptions);

//     // console.log("info : " , info);

//     let password = new forgotPasswordModel({
//       userEmail: email,
//       resetPasswordToken: token,
//     });

//     await password.save();

//     return true;
//   } catch (error) {
//     console.error(error);
//     return false;
//   }
// };

// let verifyResetPasswordPin = async (email, resetPassowrdPin) => {
//   try {
//     //let word = new ResetPassword({ userEmail: email, resetPasswordToken: resetPassowrdPin });
//     let verify = await ResetPassword.findOne({ userEmail: email });
//     if (!verify) return false;

//     // let validPassword = bcrypt.compareSync(
//     //   resetPassowrdPin,
//     //   verify.resetPasswordToken
//     // ); //user password is stored as hashed

//     if (resetPassowrdPin != verify.resetPasswordToken)
//       return false;

//     verify.verified = true;
//     await verify.save();
//     return true;
//   } catch (error) {
//     console.error(error);
//     return false;
//   }
// };

// module.exports.sendResetPasswordPin = sendResetPasswordPin;
// module.exports.verifyResetPasswordPin = verifyResetPasswordPin;
