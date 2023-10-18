var express = require("express");
var router = express.Router();
const blockchainTransaction = require("../../models/BlockchainTransactions");
const auth = require("../../middlewares/auth");

const passport = require("passport");
const verifyUser = passport.authenticate("jwt", {
  session: false,
});

router
  .route("/")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async (req, res, next) => {
      try {
        const transactions = await blockchainTransaction.find();

        if (transactions.length === 0) {
          return res.status(404).json({
            success: true,
            message: "No transactions found",
          });
        }

        return res.json({
          success: true,
          transactions: transactions,
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

router
  .route("/by-value")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async (req, res, next) => {
      try {
        const { low, high } = req.query;

        if (!high && !low) {
          return res.status(400).json({
            success: false,
            err: "undefined query params.",
          });
        }

        if (!low) {
          return res.status(400).json({
            success: false,
            err: "low not found in query params.",
          });
        }

        if (!high) {
          return res.status(400).json({
            success: false,
            err: "high not found in query params.",
          });
        }

        if (high < 0) {
          return res.status(400).json({
            success: false,
            err: "high must be greater than 0.",
          });
        }

        if (low < 0) {
          return res.status(400).json({
            success: false,
            err: "high must be greater than 0.",
          });
        }

        if (high <= low) {
          return res.status(400).json({
            success: false,
            err: "high must be greater than low.",
          });
        }

        const transactions = await blockchainTransaction.find({
          txFeeInUsd: {
            $lt: high,
            $gt: low,
          },
        });

        if (transactions.length === 0) {
          return res.status(404).json({
            success: true,
            message: "No transactions found",
          });
        }

        return res.json({
          success: true,
          transactions: transactions,
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

router
  .route("/by-date/:startDate/:endDate")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async (req, res, next) => {
      try {
        const { startDate, endDate } = req.params;

        const transactions = await blockchainTransaction.find({
          createdAt: {
            $gt: new Date(new Date(startDate)),
            $lt: new Date(new Date(endDate)),
          },
        });

        if (transactions.length === 0) {
          return res.status(404).json({
            success: true,
            message: "No transactions found",
          });
        }

        return res.json({
          success: true,
          transactions: transactions,
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

router
  .route("/count")
  .get(
    auth.verifyToken,
    verifyUser,
    auth.checkIsInRole("user", "admin"),
    async (req, res, next) => {
      try {
        const count = await blockchainTransaction.count();

        return res.json({
          success: true,
          transactionCount: count,
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

module.exports = router;
