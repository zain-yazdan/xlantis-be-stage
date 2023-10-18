// const mongoose = require('mongoose');
// const VerifyEmail = require('../models/v1-sso/VerifyEmailModel');
// const crypto = require('crypto');
// const bcrypt = require('bcrypt');
// const transporter = require('../config/nodemailer')();
// const BCRYPT_SALT_ROUNDS = 12;

// const sendApprovedAccountEmail = async (email) => {
//   try {
//     console.log(email);
//     const mailOptions = {
//       from: '"RobotDrop" support@RobotDrop.com',
//       to: email,
//       subject: 'RobotDrop Account Approved',
//       html:
//         '<h4><b>RobotDrop Account Approved</b></h4>' +
//         '<p>Your Account for RobotDrop has been Approved by the Admin. Kindly Login to access our features.</p><br><br>' +
//         '<br><br>',
//     };
//     // send mail with defined transport object
//     const info = await transporter.sendMail(mailOptions);

//     return true;
//   } catch (error) {
//     console.error(error);
//     return false;
//   }
// };

// const sendRejectedAccountEmail = async (email) => {
//   try {
//     const mailOptions = {
//       from: '"RobotDrop" support@RobotDrop.com',
//       to: email,
//       subject: 'RobotDrop Account Rejected',
//       html:
//         '<h4><b>RobotDrop Account Rejected</b></h4>' +
//         '<p>Your Account for RobotDrop has been Rejected by the Admin. Email us at support@RobotDrop.com for further queries.</p><br><br>' +
//         '<br><br>',
//     };
//     // send mail with defined transport object
//     const info = await transporter.sendMail(mailOptions);
//     return true;
//   } catch (error) {
//     console.error(error);
//     return false;
//   }
// };

// const sendVerifyEmailURL = async (CLIENT_NAME, email) => {
//   try {
//     token = crypto.randomBytes(4).toString('hex');
//     const hashedToken = await bcrypt.hash(token, BCRYPT_SALT_ROUNDS);

//     const verification = new VerifyEmail({
//       userEmail: email,
//       verifyEmailToken: hashedToken,
//     });
//     await verification.save();

//     const url = CLIENT_NAME + `/users/emailverification` + '/' + email + '/' + token;

//     const mailOptions = {
//       from: '"RobotDrop" support@RobotDrop.com',
//       to: email,
//       subject: 'Verify your Email',
//       html:
//         '<h4><b>Verify Your Email</b></h4>' +
//         '<p>To verify your email, open the link:</p><br><br>' +
//         `<a href=${url}>` +
//         url +
//         '</a>' +
//         '<br><br>',
//     };
//     // send mail with defined transport object
//     const info = await transporter.sendMail(mailOptions);

//     return true;
//   } catch (error) {
//     console.error(error);
//     return false;
//   }
// };

// const verifyEmail = async (email, verifyEmailToken) => {
//   try {
//     // let word = new ResetPassword({ userEmail: email, resetPasswordToken: resetPassowrdPin });
//     const verify = await VerifyEmail.findOne({userEmail: email});
//     if (!verify) return false;

//     const validPassword = bcrypt.compareSync(
//         verifyEmailToken,
//         verify.verifyEmailToken,
//     ); // user password is stored as hashed
//     if (!validPassword) return false;

//     verify.verified = true;
//     await verify.save();
//     return true;
//   } catch (error) {
//     console.error(error);
//     return false;
//   }
// };

// module.exports.sendVerifyEmailURL = sendVerifyEmailURL;
// module.exports.verifyEmail = verifyEmail;
// module.exports.sendRejectedAccountEmail = sendRejectedAccountEmail;
// module.exports.sendApprovedAccountEmail = sendApprovedAccountEmail;
