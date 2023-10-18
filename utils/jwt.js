const jwt = require("jsonwebtoken");
require("dotenv").config();

exports.sign = async function (payload) {
  let signOptions = {
    // issuer: "mingaproject.com",
    // subject: `${id}`,
    // audience: "mingaproject.com",
    // algorithm: "RS256",
    // expiresIn: 60
    expiresIn: parseInt(process.env.JWT_EXPIRY_TIME),
  };
  return await jwt.sign(payload, process.env.JWT_KEY, signOptions);
};

exports.verify = async function (token) {
  try {
    return await jwt.verify(token, process.env.JWT_KEY);
  } catch (error) {
    return;
  }
};
