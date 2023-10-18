const Web3 = require('web3');
require('dotenv').config()
const UserModel = require("../models/UserModel");
const { ERC1155FactoryAbi } = require("../blockchain/abi");
const { saveTransaction } = require("../utils/blockchain");

const { decrypt } = require("../utils/encrypt-decrypt-key");
const parseReceiptEvents = require("web3-parse-receipt-events");

const web3 = new Web3(process.env.WEB_SOCKET);
const SUPER_ADMIN_WALLET_ADDRESS = process.env.SUPER_ADMIN_WALLET_ADDRESS;
// Global Variables
// its value is in percentage
const INCREASE_GAS_PRICE_BY = 10;   // TODO: need to store this value in .env
let queue = {};   // to store txs data/state
let nonce;

// to set nonce value when the server starts
async function init()
{
  try {
    nonce = await web3.eth.getTransactionCount(SUPER_ADMIN_WALLET_ADDRESS, 'latest');
    console.log("(super-admin-utils) nonce init(): ", nonce);
    const cloneCreationResult = await createEstimationClone();
    if (!cloneCreationResult.success) process.exit(0);
    console.log('estimation clone setup by super-admin')
  } catch (error) {
    console.log("error (getNonce) : ", error);
  }
}

// parameters to be passed (sample parameters)
// const txData = {
//   fromAddress: SUPER_ADMIN_ADDRESS, 
//   privateKey: SUPER_ADMIN_PRIVATE_KEY,
//   contractAddress: CONTRACT_ADDRESS,
//   functionAbi: await contract.methods.setNum(10),
// }
async function sendTokenTransferTx(txData)
{
  const result = await sendTransaction(txData);
  // console.log("result:", result);

  console.log(`(super-admin-utils) result.success === ${result.success}, nonce: ${result.nonce}`);
  let response = {
    success: result.success,
    nonce: result.nonce
  }

  if(result.success === true) {
    // tx succesfully mined

    response.txHash = result.txHash;
  }
  else {
    // tx failed

    // (TODO) save failed tx in DB

    await handleFailedTx(result.nonce);
  }

  delete queue[result.nonce];

  return response;
}

async function sendTransaction(txData)
{
  const nonce = getNewNonce();

  let { 
    fromAddress, 
    privateKey, 
    contractAddress,
    functionAbi
   } = txData;
  
  queue[nonce] = {
    status: "pending",
    txData
  };

  try {
    
    const gasEstimate = await functionAbi.estimateGas({ from: fromAddress });
    const gasPrice = await web3.eth.getGasPrice();
    console.log(`nonce: ${nonce}, gasPrice: ${parseInt(gasPrice)}`);
    queue[nonce].txData.gasPrice = gasPrice;

    const tx = {
      data: functionAbi.encodeABI(), 
      to: contractAddress,
      from: fromAddress,
      gas: gasEstimate,
      nonce,
      gasPrice
    }

    const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
    // console.log(`Tx with nonce: ${nonce} sent`);

    var receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    // console.log("receipt: ", receipt);

    queue[nonce].status = "success";
    
    console.log(`\t(super-admin-utils) Tx with nonce: ${nonce} successfull`);
    
    return { success: true, nonce: tx.nonce, txHash: receipt.transactionHash };

  } catch (error) {
    queue[nonce].status = "failed";
    console.log(`(super-admin-utils) Tx with nonce: ${nonce} failed`);
    console.log("(super-admin-utils) error (sendTransaction): ", error);

    return { success: false, error, nonce };
  }
}

async function handleFailedTx(failedTxNonce)
{
  const txsCount = getTotalTxsInQueue(failedTxNonce);
  // console.log("txsCount: ", txsCount);

  if(txsCount === 1) {
    // Case 1 (no other tx present in the queue)
    console.log("case 1 (no other tx in queue)");
    nonce --;
    console.log(`correct nonce: ${nonce}, failedTxNonce: ${failedTxNonce}`);
    // now failed tx will be replaced with the new one
  }
  else {
    // Case 2 (skip tx)
    console.log("case 2 (send self/fake tx)");
    await sendSelfTransaction(nonce);
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
      to: SUPER_ADMIN_WALLET_ADDRESS, 
      from: SUPER_ADMIN_WALLET_ADDRESS,
      gas: 21000,
      nonce: failedTxNonce,
      gasPrice: increasedGasPrice.toString()
    }
   
    const signedTx = await web3.eth.accounts.signTransaction(tx, decrypt(process.env.SUPER_ADMIN_PRIVATE_KEY));

    // console.log(`Self tx with failedTxNonce: ${failedTxNonce} sent`);
    
    var receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    // console.log("receipt: ", receipt);
    // console.log(`\tSelf tx with failedTxNonce: ${failedTxNonce} successfull`);

    return ({ success: true, nonce: failedTxNonce, txHash: receipt.transactionHash });

  } catch (error) {

    console.log(`(super-admin-utils) (nonce:${nonce}) TX ERROR`);
    console.log("(super-admin-utils) error (sendSelfTransaction): ", error);

    return { success: false, error, nonce };
  }
}

function increaseGasPrice(gasPrice) {
  var num = parseInt(gasPrice);
  const newGasPrice = parseInt(num + num * INCREASE_GAS_PRICE_BY / 100);
  // console.log("newGasPrice: ", newGasPrice);
  return newGasPrice;
}


const createEstimationClone = async () => {
  try {
    const superAdmin = await UserModel.findOne({
      role: "super-admin",
      walletAddress: process.env.SUPER_ADMIN_WALLET_ADDRESS,
      email: process.env.SUPER_ADMIN_EMAIL,
    });

    if (superAdmin.estimationCloneAddress) return { success: true };
    const cloneId = web3.utils.padRight(web3.utils.toHex(superAdmin._id), 64);
    const royaltyFee = parseInt(5 * 100);
    const ERC1155_Factory = new web3.eth.Contract(
      ERC1155FactoryAbi,
      process.env.ERC1155_FACTORY_ADDRESS
    );
      
    const createNFT1155 = await ERC1155_Factory.methods.createNFT1155(
      cloneId,
      royaltyFee
    );
    const encodedABI = createNFT1155.encodeABI();
    const txData = {
      from: process.env.SUPER_ADMIN_WALLET_ADDRESS,
      to: process.env.ERC1155_FACTORY_ADDRESS,
      data: encodedABI,
    };
    console.log('estimating gas for tx...');
    const gasEstimate = await web3.eth.estimateGas(txData);

    txData.gasEstimate = gasEstimate;
    txData.gas = gasEstimate,

    console.log('signing tx...');
    const signTx = await web3.eth.accounts.signTransaction(
      txData,
      decrypt(process.env.SUPER_ADMIN_PRIVATE_KEY)
    );
    let receipt = await web3.eth.sendSignedTransaction(signTx.rawTransaction);
    console.log('call successful, transaction hash: ', receipt.transactionHash);

    receipt = parseReceiptEvents(ERC1155FactoryAbi, process.env.ERC1155_FACTORY_ADDRESS, receipt);
    console.log('receipt: ', receipt)
    await saveTransaction(superAdmin._id, receipt);
    console.log('tx saved to database, updating related database documents...');
    const cloneCreatedEvent = receipt.events.CloneCreated;
    if (!cloneCreatedEvent) {
      throw new Error('CloneCreated event not found in receipt');
    }
    console.log('estimation clone address: ', cloneCreatedEvent.returnValues.cloneAddress)
    await superAdmin.updateOne({ estimationCloneAddress: cloneCreatedEvent.returnValues.cloneAddress})
    return { success: true };
  } catch (err) {
    console.log("err: ", err.message);
    return { success: false, error: err.message };
  }
};

module.exports = {
  init,
  sendTokenTransferTx
}