const Web3 = require("web3");
const web3 = new Web3();
require('dotenv').config();

web3.setProvider(process.env.WEB_SOCKET);


async function getWalletBalance(walletAddress) {
    try {
        const balanceInWei = await web3.eth.getBalance(walletAddress);
        const balance = {
            inWei: balanceInWei,
            inMatic: convertWeiToMatic(balanceInWei)
        }
        return balance;
    } catch (error) {
        return error;
    }
}

function convertMaticToWei(valueInMatic) {
    return web3.utils.toWei(valueInMatic.toString(), 'ether');
}

function convertWeiToMatic(valueInWei) {
    return web3.utils.fromWei(valueInWei.toString(), 'ether');
}

// testing code
// const inMatic = 0.5;
// const convertedValueInWei = convertMaticToWei(inMatic);
// const convertedValueInmatic = convertWeiToMatic(convertedValueInWei);

// console.log("inMatic : ", inMatic);
// console.log("convertedValueInWei : ", convertedValueInWei);
// console.log("convertedValueInmatic : ", convertedValueInmatic);

// test()
// async function test() {
//     const walletAddress = "0x82246D620e1CAC6DA684B50CF18108aF8d065b72";
//     console.log("balance : ", await getWalletBalance(walletAddress));
// }

module.exports = {
    getWalletBalance,
    convertMaticToWei,
    convertWeiToMatic
}