const axios = require("axios");
const url = process.env.CRYPTO_PRICE_API_URL;

async function getMaticPriceInUsd() {
  return new Promise((resolve, reject) => {
    axios
      .get(url)
      .then(function (response) {
        let price = response.data.USD;
        console.log("1 matic price: ", price);
        resolve(price);
      })
      .catch(function (error) {
        console.log("matic balance query failed: ", error);
        reject(error);
      });
  });
}
const convertMaticInUsd = async function (matic) {
  const price = await getMaticPriceInUsd();
  return price * matic;
};

const convertUSDInMatic = async function (dollars) {
  const price = await getMaticPriceInUsd();
  return dollars / price;
};

module.exports = {
  convertMaticInUsd,
  convertUSDInMatic
};
