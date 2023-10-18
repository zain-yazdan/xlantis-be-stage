var express = require("express");
var router = express.Router();

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "Xlantis Marketplace Backend" });
});

router.get("/is-live", (req, res, next) => {
  res.status(200).send("Server is live and running!");
});

module.exports = router;
