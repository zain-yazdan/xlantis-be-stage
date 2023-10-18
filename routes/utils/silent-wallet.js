const Web3 = require("web3");
const web3 = new Web3();
web3.setProvider(process.env.WEB_SOCKET);

const Cryptr = require("cryptr");
const cryptr = new Cryptr(process.env.CRYPTR_SECRET_KEY, { saltLength: 12 });

const parseReceiptEvents = require("web3-parse-receipt-events");
const Web3EthAbi = require("web3-eth-abi");
const axios = require("axios");

const ABIs = require("../../blockchain/abi");
const { saveTransaction } = require("../../utils/blockchain");
const { saveBalanceHistory } = require("../../utils/balance-history");
const { sendNotification } = require("../../utils/notification");
const { decrypt } = require("../../utils/encrypt-decrypt-key");

const UserModel = require("../../models/UserModel");
const DropModel = require("../../models/DropModel");
const NFTModel = require("../../models/NFTModel");
const OrderListing = require("../../models/OrderListingModel");
const CollectionModel = require("../../models/CollectionModel");
const NotificationModel = require("../../models/NotificationModel");
const BalanceHistoryModel = require("../../models/BalanceHistoryModel");

const getHash = (id) => {
  const hex = Web3.utils.toHex(id);
  // console.log("conversion to hex: ", hex);
  return hex;
};
const createCollections = async (user, collections, objectId) => {
  try {
    console.log('\ncreating collections on blockchain...');
    const cloneIds = [];
    const royaltyFees = [];
    for (let i = 0; i < collections.length; i++) {
      cloneIds[i] = Web3.utils.padRight(getHash(collections[i]._id), 64);
      royaltyFees[i] = parseInt(collections[i].royaltyFee * 100);
    }

    const ERC1155_Factory = new web3.eth.Contract(
      ABIs.ERC1155FactoryAbi,
      process.env.ERC1155_FACTORY_ADDRESS
    );

    const batchCreateNFT1155 = await ERC1155_Factory.methods.batchCreateNFT1155(
      cloneIds,
      royaltyFees
    );
    const encodedABI = batchCreateNFT1155.encodeABI();
    const txData = {
      from: user.walletAddress,
      to: process.env.ERC1155_FACTORY_ADDRESS,
      data: encodedABI,
    };
    console.log('estimating gas for tx...');
    const gasEstimate = await web3.eth.estimateGas(txData);

    txData.gasEstimate = gasEstimate;

    console.log('getting tx signed from polygon-api...');
    const endpoint = `${process.env.POLYGON_API_URL}/transaction/sign-tx`;
    const body = {
      userId: user.xmannaUserId,
      txData,
    };
    const config = {
      headers: {
        Authorization: `Basic ${process.env.XMANNA_BASIC_AUTH_TOKEN}`,
        "X-API-KEY": process.env.XMANNA_POLYGON_API_KEY,
      },
    };

    // call sign-tx endpoint from the xmanna polygon api
    let signature = await axios.post(endpoint, body, config);
    console.log('tx signature recieved from polygon-api, sending tx to blockchain...');

    let receipt = await web3.eth.sendSignedTransaction(
      signature.data.body.rawTransaction
    );
    console.log('call successful, transaction hash: ', receipt.transactionHash);
    receipt = parseReceiptEvents(
      ABIs.ERC1155FactoryAbi,
      process.env.ERC1155_FACTORY_ADDRESS,
      receipt
    );
    await saveTransaction(user._id, receipt);
    await saveBalanceHistory(null, receipt, "Collection Creation",objectId);

    console.log('tx saved to database, updating related database documents...');

    let looper = receipt.events.CloneCreated.length;
    if (looper == undefined) looper = 1;

    for (let i = 0; i < looper; i++) {
      let rvalue = "";

      if (looper == 1)
        rvalue = receipt.events.CloneCreated.returnValues.cloneId;
      else rvalue = receipt.events.CloneCreated[i].returnValues.cloneId;

      if (
        Web3.utils.padRight(getHash(getHash(collections[i]._id), 64) == rvalue)
      ) {
        let nftContractAddress = "";

        if (looper == 1)
          nftContractAddress =
            receipt.events.CloneCreated.returnValues.cloneAddress;
        else
          nftContractAddress =
            receipt.events.CloneCreated[i].returnValues.cloneAddress;

        const updation = await CollectionModel.updateOne(
          {
            _id: collections[i]._id,
          },
          {
            nftContractAddress: nftContractAddress,
            isDeployed: true,
          }
        );
        console.log("collection documents updated: ", updation.modifiedCount);
      }
    }
    return { success: true };
  } catch (err) {
    console.log("err: ", err.message);
    return { success: false, error: err.message };
  }
};

const estimateCollectionsCreation = async (superAdmin, collections) => {
  try {
    console.log('estimating tx fees for collections...');
    const cloneIds = [];
    const royaltyFees = [];

    for (let i = 0; i < collections.length; i++) {
      cloneIds[i] = Web3.utils.padRight(getHash(collections[i]._id), 64);
      royaltyFees[i] = parseInt(collections[i].royaltyFee * 100);
    }

    const ERC1155_Factory = new web3.eth.Contract(
      ABIs.ERC1155FactoryAbi,
      process.env.ERC1155_FACTORY_ADDRESS
    );

    const batchCreateNFT1155 = await ERC1155_Factory.methods.batchCreateNFT1155(
      cloneIds,
      royaltyFees
    );
    const encodedABI = batchCreateNFT1155.encodeABI();
    const txData = {
      from: process.env.SUPER_ADMIN_WALLET_ADDRESS,
      to: process.env.ERC1155_FACTORY_ADDRESS,
      data: encodedABI,
    };
    const gasPrice = await web3.eth.getGasPrice();
    const gasEstimate = await web3.eth.estimateGas(txData);
    return gasEstimate * gasPrice;
  } catch (err) {
    console.log("err: ", err.message);
    return { success: false, error: err.message };
  }
};

const estimateApprovals = async (superAdmin) => {
  try {
    console.log('estimating tx fees for super-admin approval txs...');
    const CollectableContract = new web3.eth.Contract(
      ABIs.ERC1155CollectableAbi,
      superAdmin.estimationCloneAddress
    );

    // Here approval is being given just to estimate the function call, super-admin gets the actual approval
    const setApproval = await CollectableContract.methods.setApprovalForAll(
      process.env.MASTER_WALLET_ADDRESS,
      true
    );

    const encodedABI = setApproval.encodeABI();
    const txData = {
      from: process.env.SUPER_ADMIN_WALLET_ADDRESS,
      to: superAdmin.estimationCloneAddress,
      data: encodedABI,
    };
    const gasPrice = await web3.eth.getGasPrice();
    const gasEstimate = await web3.eth.estimateGas(txData);

    return gasEstimate * gasPrice;
  } catch (err) {
    console.log("err: ", err.message);
    return { success: false, error: err.message };
  }
};

const mintNFTs = async (user, mint_txs, objectId) => {
  try {
    console.log('\nminting nfts on blockchain...');
    let encodings = [];
    let targetAddresses = [];
    const mintFunctionABI = ABIs.ERC1155CollectableAbi.find((item) => item.name === "mintBatch");
    if (!mintFunctionABI) {
      console.log("mint-batch function not found in ERC-1155 Collectable ABI.");
      throw new Error('mint-batch function not found in ERC-1155 Collectable ABI')
    } 

    for (let i = 0; i < mint_txs.length; i++) {
      let supply = [];
      let tokenURIs = [];
      let ids = [];
      for (let j = 0; j < mint_txs[i].nftIds.length; j++) {
        supply[j] = mint_txs[i].nftIds[j].totalSupply;
        tokenURIs[j] = mint_txs[i].nftIds[j].nftURI + Date.now();
        ids[j] = mint_txs[i].nftIds[j].nftId;
      }
      const encoding = Web3EthAbi.encodeFunctionCall(
        mintFunctionABI,
        [user.walletAddress, ids, supply, tokenURIs, "0x00"]
      );

      encodings.push(encoding);
      targetAddresses[i] = mint_txs[i].contractAddress;
    }

    const MulticallContract = new web3.eth.Contract(
      ABIs.MulticallAbi,
      process.env.MULTICALL_ADDRESS
    );

    const multiCall = await MulticallContract.methods.multiCall(
      targetAddresses,
      encodings
    );
    const encodedABI = multiCall.encodeABI();
    const txData = {
      from: user.walletAddress,
      to: process.env.MULTICALL_ADDRESS,
      data: encodedABI,
    };
    console.log('estimating gas for tx...');
    const gasEstimate = await web3.eth.estimateGas(txData);
    txData.gasEstimate = gasEstimate;

    console.log('getting tx signed from polygon-api...');
    const endpoint = `${process.env.POLYGON_API_URL}/transaction/sign-tx`;
    const body = {
      userId: user.xmannaUserId,
      txData,
    };
    const config = {
      headers: {
        Authorization: `Basic ${process.env.XMANNA_BASIC_AUTH_TOKEN}`,
        "X-API-KEY": process.env.XMANNA_POLYGON_API_KEY,
      },
    };

    // call sign-tx endpoint from the xmanna polygon api
    let signature = await axios.post(endpoint, body, config);
    console.log('tx signature recieved from polygon-api, sending tx to blockchain...');

    let receipt = await web3.eth.sendSignedTransaction(
      signature.data.body.rawTransaction
    );

    if (receipt) {
      console.log('call successful, transaction hash: ', receipt.transactionHash);

      receipt = parseReceiptEvents(
        ABIs.MulticallAbi,
        process.env.MULTICALL_ADDRESS,
        receipt
      );
      await saveTransaction(user._id, receipt);
      await saveBalanceHistory(null, receipt, "Mint NFT(s)",objectId);

      console.log('tx saved to database, updating related database documents...');
      for (let i = 0; i < mint_txs.length; i++) {
        const updation = await NFTModel.updateMany(
          {
            _id: {
              $in: mint_txs[i].nftIds.map((nft) => nft._id),
            },
          },
          {
            isMinted: true,
          }
        );
        console.log("nft documents updated: ", updation.modifiedCount);
      }
    } else console.log("NFTs not minted");
    return { success: true };
  } catch (err) {
    console.log("err: ", err.message);
    return { success: false, error: err.message };
  }
};

const estimateMints = async (superAdmin, mint_txs) => {
  try {
    console.log('estimating tx fees for minting nfts...');
    let encodings = [];
    let targetAddresses = [];
    const mintFunctionABI = ABIs.ERC1155CollectableAbi.find((item) => item.name === "mintBatch");
    if (!mintFunctionABI) {
      console.log("mint-batch function not found in ERC-1155 Collectable ABI.");
      throw new Error('mint-batch function not found in ERC-1155 Collectable ABI')
    } 

    for (let i = 0; i < mint_txs.length; i++) {
      let supply = [];
      let tokenURIs = [];
      let ids = [];
      for (let j = 0; j < mint_txs[i].nftIds.length; j++) {
        supply[j] = mint_txs[i].nftIds[j].totalSupply;
        tokenURIs[j] = mint_txs[i].nftIds[j].nftURI + Date.now();
        ids[j] = mint_txs[i].nftIds[j].nftId;
      }

      const encoding = Web3EthAbi.encodeFunctionCall(
        mintFunctionABI,
        [process.env.SUPER_ADMIN_WALLET_ADDRESS, ids, supply, tokenURIs, "0x00"]
      );

      encodings.push(encoding);
      targetAddresses[i] = mint_txs[i].contractAddress;
    }

    const MulticallContract = new web3.eth.Contract(
      ABIs.MulticallAbi,
      process.env.MULTICALL_ADDRESS
    );

    const multiCall = await MulticallContract.methods.multiCall(
      targetAddresses,
      encodings
    );
    const encodedABI = multiCall.encodeABI();
    const txData = {
      from: process.env.SUPER_ADMIN_WALLET_ADDRESS,
      to: process.env.MULTICALL_ADDRESS,
      data: encodedABI,
    };
    const gasPrice = await web3.eth.getGasPrice();
    const gasEstimate = await web3.eth.estimateGas(txData);

    return gasEstimate * gasPrice;
  } catch (err) {
    console.log("err: ", err.message);
    return { success: false, error: err.message };
  }
};

const setApprovalForAll = async (user, auctions, fixedPrices) => {
  try {
    for (let i = 0; i < auctions.length; i++) {
      const CollectableContract = new web3.eth.Contract(
        ABIs.ERC1155CollectableAbi,
        auctions[i].nftContractAddress
      );

      console.log(
        "givinf auction approval to: ",
        auctions[i].nftContractAddress
      );
      const setApprovalForAuctions =
        await CollectableContract.methods.setApprovalForAll(
          process.env.ERC1155_AUCTION_DROP_FACTORY_ADDRESS,
          true
        );

      const encodedABI = setApprovalForAuctions.encodeABI();
      const txData = {
        from: user.walletAddress,
        to: auctions[i].nftContractAddress,
        data: encodedABI,
      };
      console.log("user: ", user.walletAddress);
      txData.gasPrice = await web3.eth.getGasPrice();
      const gasEstimate = await web3.eth.estimateGas(txData);

      txData.gasLimit = web3.utils.toHex(gasEstimate * 10);
      console.log("txData: ", txData);

      const signTx = await web3.eth.accounts.signTransaction(
        txData,
        cryptr.decrypt(user.privateKey)
      );
      console.log("txData: ", txData);
      let receipt = await web3.eth.sendSignedTransaction(
        signTx.raw || signTx.rawTransaction
      );
      receipt = parseReceiptEvents(
        ABIs.ERC1155CollectableAbi,
        auctions[i].nftContractAddress,
        receipt
      );
      // console.log("receipt: ", receipt);

      if (receipt.events.ApprovalForAll) {
        const updation = await CollectionModel.updateOne(
          {
            nftContractAddress: auctions[i].nftContractAddress,
          },
          {
            isAuctionDropVerified: true,
          }
        );
        console.log("auction updation: ", updation);
      }
    }

    for (let i = 0; i < fixedPrices.length; i++) {
      const CollectableContract = new web3.eth.Contract(
        ABIs.ERC1155CollectableAbi,
        fixedPrices[i].nftContractAddress
      );

      const setApprovalForFixedPrices =
        await CollectableContract.methods.setApprovalForAll(
          process.env.ERC1155_FIXED_PRICE_DROP_FACTORY_ADDRESS,
          true
        );

      const encodedABI = setApprovalForFixedPrices.encodeABI();
      const txData = {
        from: user.walletAddress,
        to: fixedPrices[i].nftContractAddress,
        data: encodedABI,
      };
      console.log("user: ", user.walletAddress);
      txData.gasPrice = await web3.eth.getGasPrice();
      const gasEstimate = await web3.eth.estimateGas(txData);

      txData.gasLimit = web3.utils.toHex(gasEstimate * 10);

      const signTx = await web3.eth.accounts.signTransaction(
        txData,
        cryptr.decrypt(user.privateKey)
      );
      console.log("txData: ", txData);
      let receipt = await web3.eth.sendSignedTransaction(
        signTx.raw || signTx.rawTransaction
      );
      receipt = parseReceiptEvents(
        ABIs.ERC1155CollectableAbi,
        fixedPrices[i].nftContractAddress,
        receipt
      );
      // console.log("receipt: ", receipt);

      if (receipt.events.ApprovalForAll) {
        const updation = await CollectionModel.updateOne(
          {
            nftContractAddress: fixedPrices[i].nftContractAddress,
          },
          {
            isFixedPriceDropVerified: true,
          }
        );
        console.log("fixed price updation: ", updation);
      }
    }
  } catch (err) {
    console.log("err: ", err.message);
    return { success: false, error: err.message };
  }
};

const deployDrop = async (user, drop) => {
  try {
    const NFTs = await NFTModel.find({
      _id: {
        $in: drop.NFTIds,
      },
      isMinted: true,
    });

    const collectionIds = [];
    for (let i = 0, j = 0; i < NFTs.length; i++) {
      if (collectionIds.indexOf(NFTs[i].collectionId.toString()) == -1) {
        collectionIds[j] = NFTs[i].collectionId.toString();
        ++j;
      }
    }
    // console.log('all distinct collection ids: ', collectionIds)

    const collections = await CollectionModel.find({
      _id: {
        $in: collectionIds,
      },
      isDeployed: true,
    }).select("_id nftId nftContractAddress");

    console.log("collections: ", collections);
    const drop_data = [];
    for (let i = 0; i < collections.length; i++) {
      let data = {
        nftContractAddress: collections[i].nftContractAddress,
      };
      let tokenIds = [];
      let amounts = [];
      let prices = [];

      const myDropNFTs = drop.NFTIds.filter((element) =>
        collections[i].nftId.includes(element)
      );
      console.log("myDropNFTs: ", myDropNFTs);

      const NFTs = await NFTModel.find({
        _id: {
          $in: myDropNFTs,
        },
        isMinted: true,
      });
      const marketPlace = await OrderListing.find({
        nftId: {
          $in: myDropNFTs,
        },
      });

      for (let j = 0; j < NFTs.length; j++) {
        (tokenIds[j] = NFTs[j].nftId),
          (amounts[j] = NFTs[j].tokenSupply),
          (prices[j] = marketPlace[j].price);
      }
      data.tokenIds = tokenIds;
      data.amounts = amounts;
      data.prices = prices;
      drop_data.push(data);
    }
    console.log("drop_data: ", drop_data);

    let cloneId = Web3.utils.padRight(getHash(drop._id), 64);
    let startTime = Math.round(drop.startTime / 1000);
    let endTime = Math.round(drop.endTime / 1000);

    console.log("startTime: ", startTime);
    console.log("endTime: ", endTime);

    if (drop.saleType == "auction") {
      const ERC1155_AuctionDrop = new web3.eth.Contract(
        ABIs.ERC1155AuctionDropFactoryAbi,
        process.env.ERC1155_AUCTION_DROP_FACTORY_ADDRESS
      );
      const createAuctionDrop =
        await ERC1155_AuctionDrop.methods.createAuctionDrop(
          cloneId,
          startTime,
          endTime,
          drop_data
        );

      const encodedABI = createAuctionDrop.encodeABI();
      const txData = {
        from: user.walletAddress,
        to: process.env.ERC1155_AUCTION_DROP_FACTORY_ADDRESS,
        data: encodedABI,
      };
      console.log("user: ", user.walletAddress);
      txData.gasPrice = await web3.eth.getGasPrice();
      const gasEstimate = await web3.eth.estimateGas(txData);

      txData.gasLimit = web3.utils.toHex(gasEstimate * 10);
      console.log("txData: ", txData);

      const signTx = await web3.eth.accounts.signTransaction(
        txData,
        cryptr.decrypt(user.privateKey)
      );
      console.log("txData: ", txData);
      let receipt = await web3.eth.sendSignedTransaction(
        signTx.raw || signTx.rawTransaction
      );
      receipt = parseReceiptEvents(
        ABIs.ERC1155AuctionDropFactoryAbi,
        process.env.ERC1155_AUCTION_DROP_FACTORY_ADDRESS,
        receipt
      );
      console.log("receipt: ", receipt);

      const updation = await drop.updateOne({
        dropCloneAddress:
          receipt.events.AuctionDropCreated.returnValues.cloneAddress,
        isCreatedOnBlockchain: true,
        status: "pending",
      });

      console.log("auction updation: ", updation);
    } else {
      const ERC1155_FixedPriceDrop = new web3.eth.Contract(
        ABIs.ERC1155FixedPriceDropFactoryAbi,
        process.env.ERC1155_FIXED_PRICE_DROP_FACTORY_ADDRESS
      );

      const createDrop = await ERC1155_FixedPriceDrop.methods.createDrop(
        cloneId,
        startTime,
        endTime,
        drop_data
      );

      const encodedABI = createDrop.encodeABI();
      const txData = {
        from: user.walletAddress,
        to: process.env.ERC1155_FIXED_PRICE_DROP_FACTORY_ADDRESS,
        data: encodedABI,
      };
      console.log("user: ", user.walletAddress);
      txData.gasPrice = await web3.eth.getGasPrice();
      const gasEstimate = await web3.eth.estimateGas(txData);

      txData.gasLimit = web3.utils.toHex(gasEstimate * 10);
      console.log("txData: ", txData);

      const signTx = await web3.eth.accounts.signTransaction(
        txData,
        cryptr.decrypt(user.privateKey)
      );
      console.log("txData: ", txData);
      let receipt = await web3.eth.sendSignedTransaction(
        signTx.raw || signTx.rawTransaction
      );
      receipt = parseReceiptEvents(
        ABIs.ERC1155FixedPriceDropFactoryAbi,
        process.env.ERC1155_FIXED_PRICE_DROP_FACTORY_ADDRESS,
        receipt
      );
      console.log("receipt: ", receipt);

      const updation = await drop.updateOne({
        dropCloneAddress: receipt.events.DropCreated.returnValues.cloneAddress,
        isCreatedOnBlockchain: true,
        status: "pending",
      });

      console.log("fixed drop updation: ", updation);
    }
  } catch (err) {
    console.log("err: ", err);
  }
};

const approveSuperAdmin = async (user, collections, objectId) => {
  try {
    for (let i = 0; i < collections.length; i++) {
      const CollectableContract = new web3.eth.Contract(
        ABIs.ERC1155CollectableAbi,
        collections[i].nftContractAddress
      );

      console.log(
        "\nGiving approval to super-admin for clone(collection): ",
        collections[i].nftContractAddress
      );
      const setApproval = await CollectableContract.methods.setApprovalForAll(
        process.env.SUPER_ADMIN_WALLET_ADDRESS,
        true
      );

      const encodedABI = setApproval.encodeABI();
      const txData = {
        from: user.walletAddress,
        to: collections[i].nftContractAddress,
        data: encodedABI,
      };
      console.log('estimating gas for tx...');
      const gasEstimate = await web3.eth.estimateGas(txData);
      txData.gasEstimate = gasEstimate;

      console.log('getting tx signed from polygon-api...');
      const endpoint = `${process.env.POLYGON_API_URL}/transaction/sign-tx`;
      const body = {
        userId: user.xmannaUserId,
        txData,
      };
      const config = {
        headers: {
          Authorization: `Basic ${process.env.XMANNA_BASIC_AUTH_TOKEN}`,
          "X-API-KEY": process.env.XMANNA_POLYGON_API_KEY,
        },
      };

      // call sign-tx endpoint from the xmanna polygon api
      let signature = await axios.post(endpoint, body, config);
      console.log('tx signature recieved from polygon-api, sending tx to blockchain...');

      let receipt = await web3.eth.sendSignedTransaction(
        signature.data.body.rawTransaction
      );
      console.log('call successful, transaction hash: ', receipt.transactionHash);

      receipt = parseReceiptEvents(
        ABIs.ERC1155CollectableAbi,
        collections[i].nftContractAddress,
        receipt
      );
      await saveTransaction(user._id, receipt);
      await saveBalanceHistory(null, receipt, "Approval Given To Super Admin", objectId);

      console.log('tx saved to database, updating related database documents...');
  
      if (receipt.events.ApprovalForAll) {
        const updation = await CollectionModel.updateOne(
          {
            nftContractAddress: collections[i].nftContractAddress,
          },
          {
            isSuperAdminApproved: true,
          }
        );
        console.log("collection documents updated: ", updation.modifiedCount);
      }
    }
    return { success: true }
  } catch (err) {
    console.log("err: ", err.message);
    return { success: false, error: err.message };
  }
};

const finalizeDropTxs = async (request, drop) => {
  try{
    const user = await UserModel.findOne({ email: request.user.email });
    user.isTxPending = true;
    await user.save();

    const notification = { userId: request.user._id }
    // Get all NFTs inside the drop
    const NFTs = await NFTModel.find({
      _id: {
        $in: drop.NFTIds,
      },
      isMinted: false,
    });

    console.log("DROP USER : ",user._id)

    let balanceHistory = await BalanceHistoryModel.create({
      userId : user._id,
      type:"Drop Creation" ,
      amountSpentInUsd: 0
    });
    let objectId = balanceHistory._id;

    // Filter unique/distinct collection ids from NFTs fetched
    const collectionIds = [];
    for (let i = 0, j = 0; i < NFTs.length; i++) {
      if (collectionIds.indexOf(NFTs[i].collectionId.toString()) == -1) {
        collectionIds[j] = NFTs[i].collectionId.toString();
        ++j; // use
      }
    }

    // Query the unique collections
    const collections = await CollectionModel.find({
      _id: {
        $in: collectionIds,
      },
      isDeployed: false,
    }).select("_id royaltyFee isDeployed");


    if (collections.length != 0) {
      const collectionCreation = await createCollections(user, collections, objectId);
      if (!collectionCreation.success) {
        notification.message = collectionCreation.error
        await NotificationModel.create(notification);
        sendNotification(notification);
        await DropModel.updateOne({
          _id: drop._id
        },{
          isTxFailed: true
        });
      }
      else{
        await DropModel.updateOne({
          _id: drop._id
        },{
          isTxFailed: false
        });
      }
    }
    else console.log('no clones(collections) needed to be deployed')

    const toApproveCollections = await CollectionModel.find({
      _id: {
        $in: collectionIds,
      },
      isSuperAdminApproved: false,
    }).select("_id nftContractAddress");

    if (toApproveCollections.length != 0) {
      const adminApproval = await approveSuperAdmin(user, toApproveCollections, objectId);
      if (!adminApproval.success) {
        notification.message = adminApproval.error
        await NotificationModel.create(notification);
        sendNotification(notification);
        await DropModel.updateOne({
          _id: drop._id
        },{
          isTxFailed: true
        });
      }
      else{
        await DropModel.updateOne({
          _id: drop._id
        },{
          isTxFailed: false
        });
      }
    } else console.log('no clones(collections) need super-admin approval');

    const mint_txs = [];
    for (let i = 0; i < collectionIds.length; i++) {
      let tx = {
        id: collectionIds[i],
        nftIds: [],
        contractAddress: "",
      };
      const nfts = await NFTModel.find({
        _id: {
          $in: drop.NFTIds,
        },
        collectionId: collectionIds[i],
        isMinted: false,
      });
      if (nfts.length != 0) {
        tx.nftIds = nfts;
        let contractAddress = await CollectionModel.find({
          _id: tx.id,
        }).select("-_id nftContractAddress");
        tx.contractAddress = contractAddress[0].nftContractAddress;
        mint_txs.push(tx);
      }
    }

    if (mint_txs.length != 0) {
      const isMinted = await mintNFTs(user, mint_txs, objectId);
      if (isMinted.success) {
        await DropModel.findByIdAndUpdate(NFTs[0].dropId, {
          status: "pending",
          isCreatedOnBlockchain: true,
        });
        notification.message = 'drop sucessfully created on blockchain'
        await NotificationModel.create(notification);
        sendNotification(notification);
        await DropModel.updateOne({
          _id: drop._id
        },{
          isTxFailed: false
        });
      } else {
        notification.message = isMinted.error
        await NotificationModel.create(notification);
        sendNotification(notification);
        await DropModel.updateOne({
          _id: drop._id
        },{
          isTxFailed: true
        });
      }
    }

    user.isTxPending = false;
    await user.save();
  }
  catch (err) {
    console.log("error (try-catch) : " + err);
     await DropModel.updateOne({
        _id: drop._id
      },{
        isTxFailed: true
      });
    return res.status(500).json({
      success: false,
      error: err,
    });
  }
};

const safeTransferFrom = async (
  userId,
  nftContractAddress,
  from,
  to,
  nftId,
  tokenSupply,
) => {
  try {
    const ERC1155Contract = new web3.eth.Contract(
      ABIs.ERC1155CollectableAbi,
      nftContractAddress
    );

    // use it for making sure nft is transfered
    // let balance = await ERC1155Contract.methods.balanceOf(from, nftId).call();
    // console.log("before transfer balance: ", balance);

    const safeTransferFrom = await ERC1155Contract.methods.safeTransferFrom(
      from,
      to,
      nftId,
      tokenSupply,
      "0x00"
    );
    let encodedABI = safeTransferFrom.encodeABI();
    let txData = {
      from: process.env.SUPER_ADMIN_WALLET_ADDRESS,
      to: nftContractAddress,
      data: encodedABI,
    };
    console.log('estimating gas for tx...');
    const gasEstimate = await web3.eth.estimateGas(txData);
    txData.gasPrice = await web3.eth.getGasPrice();
    txData.gasLimit = web3.utils.toHex(gasEstimate * 10);

    console.log('super-adin is signing tx...');
    const signTx = await web3.eth.accounts.signTransaction(
      txData,
      decrypt(process.env.SUPER_ADMIN_PRIVATE_KEY)
    );

    console.log('tx signature complete, sending tx to blockchain...');
    let receipt = await web3.eth.sendSignedTransaction(signTx.rawTransaction);
    console.log('call successful, transaction hash: ', receipt.transactionHash);

    // use it for making sure nft is transfered
    // balance = await ERC1155Contract.methods.balanceOf(from, nftId).call();
    // console.log("after transfer balance: ", balance);

    receipt = parseReceiptEvents(
      ABIs.ERC1155CollectableAbi,
      nftContractAddress,
      receipt
    );
    await saveTransaction(userId, receipt);
    
    const events = Object.keys(receipt.events);
    if (events.indexOf("TransferSingle") != -1) return { success: true };
  } catch (err) {
    console.log("err: ", err.message);
    return { success: false, error: err.message };
  }
};

const approvePaymentToken = async (user, factoryAddress, price) => {
  try {
    console.log(
      `approving dropCloneAddress ${factoryAddress} an allowance of ${price}`
    );
    
    const ERC20Contract = new web3.eth.Contract(ABIs.ERC20Abi, process.env.ERC_20);
    const approve = await ERC20Contract.methods.approve(factoryAddress, price);
    const encodedABI = approve.encodeABI();
    const txData = {
      from: user.walletAddress,
      to: process.env.ERC_20,
      data: encodedABI,
    };
    txData.gasPrice = await web3.eth.getGasPrice();
    const gasEstimate = await web3.eth.estimateGas(txData);

    txData.gasLimit = web3.utils.toHex(gasEstimate * 10);

    const signTx = await web3.eth.accounts.signTransaction(
      txData,
      cryptr.decrypt(user.privateKey)
    );
    let receipt = await web3.eth.sendSignedTransaction(
      signTx.raw || signTx.rawTransaction
    );
    receipt = parseReceiptEvents(ABIs.ERC20Abi, process.env.ERC_20, receipt);
    console.log("payment token approval receipt: ", receipt);
    return { success: true };
  } catch (err) {
    console.log("err: ", err.message);
    return { success: false, error: err.message };
  }
};

const buyNFT = async (user, dropId, NFT, price) => {
  try {
    console.log(`making NFT buy tx from ${user.walletAddress}...`);
    const ERC20Contract = new web3.eth.Contract(ABIs.ERC20Abi, process.env.ERC_20);
    let userBalance = await ERC20Contract.methods
      .balanceOf(user.walletAddress)
      .call();
    console.log("user payment token balance: ", userBalance);

    const ERC1155_FixedPriceDrop = new web3.eth.Contract(
      ABIs.ERC1155FixedPriceDropFactoryAbi,
      process.env.ERC1155_FIXED_PRICE_DROP_FACTORY_ADDRESS
    );

    const executeOrder = await ERC1155_FixedPriceDrop.methods.executeOrder(
      getHash(dropId),
      NFT.collectionId.nftContractAddress,
      NFT.nftId,
      NFT.tokenSupply,
      price
    );
    const encodedABI = executeOrder.encodeABI();
    const txData = {
      from: user.walletAddress,
      to: process.env.ERC1155_FIXED_PRICE_DROP_FACTORY_ADDRESS,
      data: encodedABI,
    };
    txData.gasPrice = await web3.eth.getGasPrice();
    const gasEstimate = await web3.eth.estimateGas(txData);

    txData.gasLimit = web3.utils.toHex(gasEstimate * 10);

    const signTx = await web3.eth.accounts.signTransaction(
      txData,
      cryptr.decrypt(user.privateKey)
    );
    let receipt = await web3.eth.sendSignedTransaction(
      signTx.raw || signTx.rawTransaction
    );
    receipt = parseReceiptEvents(
      ABIs.ERC1155FixedPriceDropFactoryAbi,
      process.env.ERC1155_FIXED_PRICE_DROP_FACTORY_ADDRESS,
      receipt
    );
    console.log("buy tx receipt: ", receipt);
    return { success: true, receipt: receipt };
  } catch (err) {
    console.log("err: ", err.message);
    return { success: false, error: err.message };
  }
};

const estimateBuy = async (user, factoryAddress, dropId, NFT, price) => {
  try {
    const ERC20Contract = new web3.eth.Contract(ABIs.ERC20Abi, process.env.ERC_20);
    const approve = await ERC20Contract.methods.approve(factoryAddress, price);

    let encodedABI = approve.encodeABI();
    let txData = {
      from: user.walletAddress,
      to: process.env.ERC_20,
      data: encodedABI,
    };
    txData.gasPrice = await web3.eth.getGasPrice();
    const approvalGasEstimate = await web3.eth.estimateGas(txData);
    console.log("approvalGasEstimate: ", approvalGasEstimate);

    // txData.gasLimit = web3.utils.toHex(approvalGasEstimate * 10);

    // const signTx = await web3.eth.accounts.signTransaction(
    // 	txData,
    // 	cryptr.decrypt(user.privateKey)
    // );
    // let receipt = await web3.eth.sendSignedTransaction(
    // 	signTx.raw || signTx.rawTransaction,
    // );

    const ERC1155_FixedPriceDrop = new web3.eth.Contract(
      ABIs.ERC1155FixedPriceDropFactoryAbi,
      process.env.ERC1155_FIXED_PRICE_DROP_FACTORY_ADDRESS
    );

    const executeOrder = await ERC1155_FixedPriceDrop.methods.executeOrder(
      Web3.utils.padRight(getHash(dropId), 64),
      NFT.collectionId.nftContractAddress,
      NFT.nftId,
      NFT.tokenSupply,
      price
    );
    encodedABI = executeOrder.encodeABI();
    txData = {
      from: user.walletAddress,
      to: process.env.ERC1155_FIXED_PRICE_DROP_FACTORY_ADDRESS,
      data: encodedABI,
    };
    txData.gasPrice = await web3.eth.getGasPrice();
    const executeOrderGasEstimate = await web3.eth.estimateGas(txData);

    console.log("executeOrderGasEstimate: ", executeOrderGasEstimate);
    return { success: true, approvalGasEstimate, executeOrderGasEstimate };
  } catch (err) {
    console.log("err: ", err.message);
    return { success: false, error: err.message };
  }
};

const createBid = async (user, NFT, bidId, bidAmount) => {
  try {
    console.log(`making NFT bid tx from ${user.walletAddress}...`);
    const ERC20Contract = new web3.eth.Contract(ABIs.ERC20Abi, process.env.ERC_20);
    let userBalance = await ERC20Contract.methods
      .balanceOf(user.walletAddress)
      .call();
    console.log("user payment token balance: ", userBalance);

    const ERC1155_AuctionDrop = new web3.eth.Contract(
      ABIs.ERC1155AuctionDropFactoryAbi,
      process.env.ERC1155_AUCTION_DROP_FACTORY_ADDRESS
    );

    console.log("making bid for bid id: ", bidId);
    console.log("making bid for bid id hash: ", getHash(bidId));

    const bidFunction = await ERC1155_AuctionDrop.methods.bid(
      getHash(NFT.dropId._id),
      getHash(bidId),
      NFT.collectionId.nftContractAddress,
      NFT.nftId,
      bidAmount
    );
    const encodedABI = bidFunction.encodeABI();
    const txData = {
      from: user.walletAddress,
      to: process.env.ERC1155_AUCTION_DROP_FACTORY_ADDRESS,
      data: encodedABI,
    };
    txData.gasPrice = await web3.eth.getGasPrice();
    const gasEstimate = await web3.eth.estimateGas(txData);

    txData.gasLimit = web3.utils.toHex(gasEstimate * 10);

    const signTx = await web3.eth.accounts.signTransaction(
      txData,
      cryptr.decrypt(user.privateKey)
    );
    let receipt = await web3.eth.sendSignedTransaction(
      signTx.raw || signTx.rawTransaction
    );
    receipt = parseReceiptEvents(
      ABIs.ERC1155AuctionDropFactoryAbi,
      process.env.ERC1155_AUCTION_DROP_FACTORY_ADDRESS,
      receipt
    );
    console.log("make bid tx receipt: ", receipt);
    return { success: true, receipt: receipt };
  } catch (err) {
    console.log("err: ", err.message);
    return { success: false, error: err.message };
  }
};

const acceptBid = async (user, NFT, bidId) => {
  try {
    console.log(`making NFT accept bid tx from ${user.walletAddress}...`);

    const ERC1155_AuctionDrop = new web3.eth.Contract(
      ABIs.ERC1155AuctionDropFactoryAbi,
      process.env.ERC1155_AUCTION_DROP_FACTORY_ADDRESS
    );

    console.log("accepting bid for bid id: ", bidId);
    console.log("accepting bid for bid id hash: ", getHash(bidId));

    const bidFunction = await ERC1155_AuctionDrop.methods.acceptBid(
      getHash(NFT.dropId),
      NFT.collectionId.nftContractAddress,
      NFT.nftId,
      getHash(bidId)
    );
    const encodedABI = bidFunction.encodeABI();
    const txData = {
      from: user.walletAddress,
      to: process.env.ERC1155_AUCTION_DROP_FACTORY_ADDRESS,
      data: encodedABI,
    };
    txData.gasPrice = await web3.eth.getGasPrice();
    const gasEstimate = await web3.eth.estimateGas(txData);

    txData.gasLimit = web3.utils.toHex(gasEstimate * 10);

    const signTx = await web3.eth.accounts.signTransaction(
      txData,
      cryptr.decrypt(user.privateKey)
    );
    let receipt = await web3.eth.sendSignedTransaction(
      signTx.raw || signTx.rawTransaction
    );
    receipt = parseReceiptEvents(
      ABIs.ERC1155AuctionDropFactoryAbi,
      process.env.ERC1155_AUCTION_DROP_FACTORY_ADDRESS,
      receipt
    );
    console.log("accept bid tx receipt: ", receipt);
    return { success: true, receipt: receipt };
  } catch (err) {
    console.log("err: ", err.message);
    return { success: false, error: err.message };
  }
};

const rawTransactionApproval = async (CONTRACT_ADDRESS, from) => {
  console.log(
    `approving dropCloneAddress ${factoryAddress} an allowance of ${price}`
  );
  const ERC20Contract = new web3.eth.Contract(ABIs.ERC20Abi, process.env.ERC_20);
  const approve = await ERC20Contract.methods.approve(factoryAddress, price);
  const gasEstimate = await approve.estimateGas({ from: from });

  const encodedABI = approve.encodeABI();
  const tx = {
    data: encodedABI,
    to: CONTRACT_ADDRESS,
    from: from,
    gas: gasEstimate,
    // maxPriorityFeePerGas: priorotyFeeInWei,
    type: "0x2",
  };

  return tx;
};

const rawTransactionBuy = async (user, dropId, NFT, price) => {
  const ERC20Contract = new web3.eth.Contract(ABIs.ERC20Abi, process.env.ERC_20);
  let userBalance = await ERC20Contract.methods
    .balanceOf(user.walletAddress)
    .call();
  console.log("user payment token balance: ", userBalance);

  const ERC1155_FixedPriceDrop = new web3.eth.Contract(
    ABIs.ERC1155FixedPriceDropFactoryAbi,
    process.env.ERC1155_FIXED_PRICE_DROP_FACTORY_ADDRESS
  );

  const executeOrder = await ERC1155_FixedPriceDrop.methods.executeOrder(
    getHash(dropId),
    NFT.collectionId.nftContractAddress,
    NFT.nftId,
    NFT.tokenSupply,
    price
  );
  const encodedABI = executeOrder.encodeABI();
  const gasEstimate = await executeOrder.estimateGas({
    from: user.walletAddress,
  });

  const txData = {
    from: user.walletAddress,
    to: process.env.ERC1155_FIXED_PRICE_DROP_FACTORY_ADDRESS,
    data: encodedABI,
    gas: gasEstimate,
  };
  return txData;
};

const transferMatic = async (userId, toAddress, amount) => {
  try {
    const txObject = {
      from: process.env.MASTER_WALLET_ADDRESS,
      to: toAddress,
      value: amount,
      gas: 21000,
    };

    const signTx = await web3.eth.accounts.signTransaction(
      txObject,
      decrypt(process.env.MASTER_WALLET_PRIVATE_KEY)
    );
    const receipt = await web3.eth.sendSignedTransaction(signTx.rawTransaction);
    await saveTransaction(userId, receipt)

    if (receipt.transactionHash) return { status: true };
  } catch (err) {
    console.log("MATIC TRANSFER FAILED: ", err.message);
    return { status: false, error: err.message };
  }
};

module.exports = {
  finalizeDropTxs: finalizeDropTxs,
  buyNFT: buyNFT,
  approvePaymentToken,
  createBid,
  acceptBid,
  estimateBuy,
  rawTransactionApproval,
  rawTransactionBuy,
  estimateCollectionsCreation,
  estimateMints,
  estimateApprovals,
  transferMatic,
  safeTransferFrom,
};
