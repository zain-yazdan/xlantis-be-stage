const jwt = require("../utils/jwt");

const userModel = require("../models/UserModel");

const passport = require("passport");

require("dotenv").config();

var JwtStrategy = require("passport-jwt").Strategy,
  ExtractJwt = require("passport-jwt").ExtractJwt;

module.exports.verifyToken = async function (req, res, next) {
  let token = req.get("Authorization");

  if (!token) {
    return res.status(401).send("You are not logged-in (token not found) !!");
  }

  if (token.includes("Bearer")) token = token.slice(7);

  let result = await jwt.verify(token);

  if (!result) {
    return res.status(401).send("Unauthorized access (invalid token) !!");
  }

  next();
};

// 03125202972

var cookieExtractor = function (req) {
  var token = req.get("Authorization");

  if (token.includes("Bearer")) token = token.slice(7);

  return token;
};

var opts = {};
opts.jwtFromRequest = cookieExtractor;
opts.secretOrKey = process.env.JWT_KEY;

opts.ignoreExpiration = true;
opts.ignoreNotBefore = true;

passport.use(
  new JwtStrategy(opts, function (jwt_payload, done) {
    console.log("jwt_payload : ", jwt_payload);

    userModel.findById(jwt_payload.userId, function (err, user) {
      if (err) {
        console.log("Auth Error: ", err);
        return done(err, false);
      }
      if (user) {
        return done(null, user);
      } else {
        console.log("Auth NULL");
        return done(null, false);
      }
    });
  })
);

const checkIsInRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).send("user not found");
    }

    const hasRole = roles.find((role) => req.user.role === role);

    if (!hasRole) {
      return res.status(400).send("Access Control: Missuse Detected");
    }

    return next();
  };

module.exports.checkIsInRole = checkIsInRole;
