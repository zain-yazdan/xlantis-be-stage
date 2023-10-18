const Web3 = require('web3');
const crypto = require("crypto");
const BlockchainTransaction = require("../models/BlockchainTransactions");
const { convertMaticInUsd } = require("../actions/crypto-convert")

const generateUint256Id = () => {
  const seed = crypto.randomBytes(4);
  const id = BigInt(`0x${seed.toString("hex")}`);
  return id.toString();
};

const saveTransaction = async (userId, receipt) => {
  try {
    const txHash = receipt.transactionHash;
    const to = receipt.to;
    const txFeeInWei = receipt.gasUsed * receipt.effectiveGasPrice;
    const txFeeInMatic = Web3.utils.fromWei(txFeeInWei.toString(), "ether");
    const txFeeInUsd = await convertMaticInUsd(txFeeInMatic);

    await BlockchainTransaction.create({
      userId,
      receipt,
      txHash,
      to,
      txFeeInWei, 
      txFeeInUsd
    })
  } catch (error) {
    console.log('error: ', error);
  }
}
module.exports = {
  generateUint256Id,
  saveTransaction
};
