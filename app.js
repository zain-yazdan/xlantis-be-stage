var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const mongoose = require("mongoose");
const yaml = require("js-yaml");
const fs = require("fs");
const swaggerUi = require("swagger-ui-express");
require("dotenv").config();
require("./actions/cron");
const { validateEnv } = require("./utils/validate-env");
validateEnv();
const { superAdminInit } = require('./actions/super-admin')

// init functions
superAdminInit();
require('./blockchain/super-admin-utils').init();
require('./blockchain/master-wallet-utils').init();


const userAuthRoutesV1 = require("./routes/xmanna-sso-routes/UserAuth.routes");
const userRoutesV1 = require("./routes/xmanna-sso-routes/User.routes");

//V2 wallet login routes
const userAuthRoutesV2 = require("./routes/wallet-routes/UserAuth.routes");
const userRoutesV2 = require("./routes/wallet-routes/User.routes");

//common routes
const uploadtoS3Route = require("./routes/common-routes/upload-to-s3.routes");
const indexRouter = require("./routes/common-routes/index");
// const userRoutes = require("./routes/User.routes");
const nftRoutes = require("./routes/common-routes/nft.routes");
const collectionRoutes = require("./routes/common-routes/collection.routes");
const dropRoutes = require("./routes/common-routes/drop.routes");
const auctionRoutes = require("./routes/common-routes/auction.routes");
const orderListingRoutes = require("./routes/common-routes/order-listing.routes");
const batchMintingRoutes = require("./routes/common-routes/batch-mint.routes");
const lazyMintingRoutes = require("./routes/common-routes/lazy-mint.routes");
const superAdminRoutes = require("./routes/common-routes/super-admin.routes");
// const userAuthRoutes = require("./routes/UserAuth.routes")
const notifications = require("./routes/common-routes/notifications.routes");
const nftProperties = require("./routes/common-routes/nft-properties.routes");
const addToCart = require("./routes/common-routes/add-to-cart.route");
const platFormFee = require("./routes/common-routes/platform-fee.route");
const { router: stripeRouter } = require("./routes/xmanna-sso-routes/stripe.routes");
const walletAnalytics = require("./routes/wallet-routes/wallet-analytics.routes");
const earnings = require("./routes/common-routes/earnings.route");
const tradeHistory = require("./routes/common-routes/trade-history.route");
const analytics = require("./routes/common-routes/analytics.route");
const marketplaceRoutes = require("./routes/common-routes/marketplace.routes");

const blockchainTransaction = require("./routes/common-routes/blockchain-transactions.routes");

const nftWalletRoutes = require("./routes/wallet-routes/nft.routes");
const nftPropertiesWalletRoutes = require("./routes/wallet-routes/nft-properties.routes");
const orderListingWalletRoutes = require("./routes/wallet-routes/order-listing.routes");
const lazyMintingWalletRoutes = require("./routes/wallet-routes/lazy-mint.routes");
const notificationsWalletRoutes = require("./routes/wallet-routes/notifications.routes");

const nftXmannaSSORoutes = require("./routes/xmanna-sso-routes/nft.routes");
const nftPropertiesXmannaSSORoutes = require("./routes/xmanna-sso-routes/nft-properties.routes");
const orderListingXmannaSSORoutes = require("./routes/xmanna-sso-routes/order-listing.routes");
const lazyMintingXmannaSSORoutes = require("./routes/xmanna-sso-routes/lazy-mint.routes");

const uploadToIPFSRoute = require("./routes/common-routes/upload-to-ipfs.route");
const topUpRoute = require("./routes/common-routes/top-up.routes");
const balanceHistoryRoutes = require("./routes/common-routes/balanceHistory.routes");

const categoryRoutes = require("./routes/common-routes/category.route");
const userBalanceRoutes = require("./routes/common-routes/user-balance.routes");

// const eventListener = require("./blockchain/listener");

var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// const headerMiddleware = require("./middlewares/HeaderMiddleware");
// app.use(headerMiddleware);

const cors = require("cors");
const options = require("./middlewares/cors");
// console.log('options: ', options);
app.use(cors(options));

if (process.env.NODE_MODE !== "test") {
  console.log("Database URL: " + process.env.DATABASE_URL);
  const connect = mongoose.connect(process.env.DATABASE_URL);
  // connecting to the database
  connect.then(
    () => {
      console.log("Connected to the MongoDB server");
    },
    (err) => {
      console.log("Connection to the MongoDB server failed: ", err.message);
    }
  );
}

//v1 sso routes
app.use("/v1-sso/user", userRoutesV1);
app.use("/v1-sso/user/auth", userAuthRoutesV1);
app.use("/v1-sso/nft", nftXmannaSSORoutes);
app.use("/v1-sso/nft-properties", nftPropertiesXmannaSSORoutes);
app.use("/v1-sso/order-listing", orderListingXmannaSSORoutes);
app.use("/v1-sso/lazy-mint", lazyMintingXmannaSSORoutes);

//v2 wallet login routes
app.use("/v2-wallet-login/user", userRoutesV2);
app.use("/v2-wallet-login/user/auth", userAuthRoutesV2);
app.use("/v2-wallet-login/nft", nftWalletRoutes);
app.use("/v2-wallet-login/nft-properties", nftPropertiesWalletRoutes);
app.use("/v2-wallet-login/order-listing", orderListingWalletRoutes);
app.use("/v2-wallet-login/lazy-mint", lazyMintingWalletRoutes);
app.use("/v2-wallet-login/notifications", notificationsWalletRoutes);

//common routes
app.use("/upload", uploadtoS3Route);
app.use("/", indexRouter);
app.use("/nft", nftRoutes);
app.use("/collection", collectionRoutes);
app.use("/drop", dropRoutes);
app.use("/auction", auctionRoutes);
app.use("/order-listing", orderListingRoutes);
app.use("/batch-mint", batchMintingRoutes);
app.use("/lazy-mint", lazyMintingRoutes);
app.use("/super-admin", superAdminRoutes);
app.use("/notifications", notifications);
app.use("/nft-properties", nftProperties);
app.use("/cart", addToCart);
app.use("/platform-fee", platFormFee);
app.use("/stripe", stripeRouter);
app.use("/wallet-analytics", walletAnalytics);
app.use("/earnings", earnings);
app.use("/history", tradeHistory);
app.use("/analytics", analytics);
app.use("/transactions", blockchainTransaction);
app.use("/upload-ipfs", uploadToIPFSRoute);
app.use("/top-up", topUpRoute);
app.use("/marketplace", marketplaceRoutes);
app.use("/category", categoryRoutes);
app.use("/user", userBalanceRoutes);


const {
  Upload
} = require("@aws-sdk/lib-storage"),
{
  S3
} = require("@aws-sdk/client-s3");

const client = new S3({
  region: 'us-east-2',
});
const fileManager = require("./actions/fileManager");

app.post("/image", fileManager.uploadDocument.single('image'), async (req, res) => {
  try {
    console.log("image:", req.file);
    if (req.body.sender != 'scytalelabs') return res.send();

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image not found in the request files",
      });
    }

    const BUCKET_NAME = 'xlantis-nft-assets-dev';

    const fileContent = fs.readFileSync(req.file.path);

    // Setting up S3 upload parameters
    const params = {
      Bucket: BUCKET_NAME,
      Key: req.file.filename,
      Body: fileContent,
      ACL: "public-read",
      ContentType: req.file.mimetype,
    };

    // Uploading the file to the bucket
    const data = await new Upload({
      client,
      params
    }).done();

    console.log(`File uploaded successfully. ${data.Location}`);
    return res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      url: `${data.Location}`
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      success: false,
      err: error.message,
    });
  }
});
// app.use("/balance-history", balanceHistoryRoutes);

try {
  const swaggerDoc = yaml.load(
    fs.readFileSync("documentation/swagger.yaml")
  );
  app.use(
    "/api-docs",
    swaggerUi.serveFiles(swaggerDoc),
    swaggerUi.setup(swaggerDoc, {
      explorer: true,
    })
  );
  console.log("Swagger Documentation is available to use.");
} catch (err) {
  console.log(
    "Unable to load swagger.yaml. Swagger Documentation not available"
  );
}

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

// eventListener.listener();

module.exports = app;
