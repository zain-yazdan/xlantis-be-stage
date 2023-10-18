const Web3 = require('web3');
const { saveTransaction } = require("../utils/blockchain");

require('dotenv').config()

const { decrypt } = require("../utils/encrypt-decrypt-key");
// console.log("process.env.WEB_SOCKET: ", process.env.WEB_SOCKET);

const web3 = new Web3(process.env.WEB_SOCKET);
const MASTER_WALLET_ADDRESS = process.env.MASTER_WALLET_ADDRESS;

// Global Variables
// its value is in percentage
const INCREASE_GAS_PRICE_BY = 10;   // TODO: need to store this value in .env
let queue = {};   // to store txs data/state
let nonce;



// to set nonce value when the server starts
async function init()
{
  try {
    nonce = await web3.eth.getTransactionCount(MASTER_WALLET_ADDRESS, 'latest');
    console.log("(master-wallet-utils) nonce init(): ", nonce);
  } catch (error) {
    console.log("(master-wallet-utils) error (getNonce) : ", error);
  }
}

// parameters to be passed (sample parameters)
// const txData = {
//   toAddress: ADMIN_WALLET_ADDRESS, 
//   amountInWei: "100000000000000000",
// }
async function sendMaticTransferTx(txData, userId)
{
  const result = await sendTransaction(txData);
  // console.log("result:", result);

  console.log(`(master-wallet-utils) result.success === ${result.success}, nonce: ${result.nonce}`);
  let response = {
    success: result.success,
    nonce: result.nonce
  }

  if(result.success === true) {
    // tx succesfully mined
    response.txHash = result.txHash;
    await saveTransaction(userId, result.receipt);
  }
  else {
    // tx failed
    // (TODO) save failed tx in DB

    const caseHandled = await handleFailedTx(result.nonce);
    response.message = caseHandled;
  }

  delete queue[result.nonce];
  return response;
}

async function sendTransaction(txData)
{
  const nonce = getNewNonce();

  let { toAddress, amountInWei } = txData;
  
  queue[nonce] = {
    status: "pending",
    txData
  };

  try {
    
    const gasPrice = await web3.eth.getGasPrice();
    console.log(`nonce: ${nonce}, gasPrice: ${parseInt(gasPrice)}`);
    // console.log("queue[nonce]: ", queue[nonce]);

    queue[nonce].txData.gasPrice = gasPrice;

    const tx = {
      to: toAddress,
      from: MASTER_WALLET_ADDRESS,
      gas: 21000,
      value: amountInWei,
      nonce,
      gasPrice
    }

    const signedTx = await web3.eth.accounts.signTransaction(tx, decrypt(process.env.MASTER_WALLET_PRIVATE_KEY));
    // console.log(`Tx with nonce: ${nonce} sent`);

    var receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    // console.log("receipt: ", receipt);

    queue[nonce].status = "success";
    
    console.log(`\t(master-wallet-utils) Tx with nonce: ${nonce} successfull`);
    
    return { success: true, nonce: tx.nonce, txHash: receipt.transactionHash, receipt };

  } catch (error) {
    queue[nonce].status = "failed";
    console.log(`(master-wallet-utils) Tx with nonce: ${nonce} failed`);
    console.log("(master-wallet-utils) error (sendTransaction): ", error);
    return { success: false, error, nonce };
  }
}

async function handleFailedTx(failedTxNonce)
{
  const txsCount = getTotalTxsInQueue(failedTxNonce);
  // console.log("(master-wallet-utils) (handleFailedTx) txsCount: ", txsCount);

  if(txsCount === 1) {
    // Case 1 (no other tx present in the queue)
    console.log("(master-wallet-utils) case 1 (no other tx in queue)");
    nonce --;
    console.log(`(master-wallet-utils) correct nonce: ${nonce}, failedTxNonce: ${failedTxNonce}`);
    // now failed tx will be replaced with the new one
    return "handled case-1";
  }
  else {
    // Case 2 (skip tx)
    console.log("(master-wallet-utils) case 2 (send self/fake tx)");
    await sendSelfTransaction(failedTxNonce);
    return "handled case-2";
  }
}

function getTotalTxsInQueue(failedTxNonce) {
    return nonce - failedTxNonce;
}

function getNewNonce() {
    return nonce ++;
}

async function sendSelfTransaction(failedTxNonce)
{
  try {
    console.log("sendSelfTransaction");

    const increasedGasPrice = increaseGasPrice(queue[failedTxNonce].txData.gasPrice);
    console.log("increasedGasPrice: ", increasedGasPrice);

    const tx = {
      to: MASTER_WALLET_ADDRESS, 
      from: MASTER_WALLET_ADDRESS,
      gas: 21000,
      nonce: failedTxNonce,
      gasPrice: increasedGasPrice.toString()
    }
    const signedTx = await web3.eth.accounts.signTransaction(tx ,decrypt(process.env.MASTER_WALLET_PRIVATE_KEY));

    // console.log(`Self tx with failedTxNonce: ${failedTxNonce} sent`);
    
    var receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    // console.log("receipt: ", receipt);
    console.log(`\tSelf tx with nonce: ${failedTxNonce} successfull`);

    return ({ success: true, nonce: failedTxNonce, txHash: receipt.transactionHash });

  } catch (error) {

    console.log(`(master-wallet-utils) (nonce:${nonce}) TX ERROR`);
    console.log("(master-wallet-utils) error (sendSelfTransaction): ", error);

    return { success: false, error, nonce };
  }
}

function increaseGasPrice(gasPrice) {
  var num = parseInt(gasPrice);
  const newGasPrice = parseInt(num + num * INCREASE_GAS_PRICE_BY / 100);
  // console.log("newGasPrice: ", newGasPrice);
  return newGasPrice;
}



module.exports = {
  init,
  sendMaticTransferTx
}