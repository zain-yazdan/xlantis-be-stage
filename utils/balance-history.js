const Web3 = require('web3');
const crypto = require("crypto");
const BalanceHistoryModel = require("../models/BalanceHistoryModel");

const { convertMaticInUsd } = require("../actions/crypto-convert")

const saveBalanceHistory = async (userId, receipt, eventName, objectId) => {
  try {
    const txFeeInWei = receipt.gasUsed * receipt.effectiveGasPrice;
    const txFeeInMatic = Web3.utils.fromWei(txFeeInWei.toString(), "ether");
    const txFeeInUsd = await convertMaticInUsd(txFeeInMatic);

    let txType={
      name : eventName,
      amountInWei : txFeeInWei,
      amountInUsd : txFeeInUsd
    }


    const balance = await BalanceHistoryModel.findById(objectId);
    let amount = Number(balance.amountSpentInUsd) + Number(txFeeInUsd);
    balance.amountSpentInUsd = amount;
    balance.txInfo.push(txType);
    let updateReport = await balance.save();
    console.log('balance history saved')
  } catch (error) {
    console.log('error: ', error);
  }
}
module.exports = {
  saveBalanceHistory
};
