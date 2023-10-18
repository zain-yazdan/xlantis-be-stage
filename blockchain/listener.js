const Web3 = require("web3");
const ABIs = require("./abi.js");
var web3 = new Web3();
require("dotenv").config();

var collectionModel = require("../models/CollectionModel");
const DropModel = require("../models/DropModel");
var provider = new web3.providers.WebsocketProvider(process.env.WEB_SOCKET);

web3.setProvider(process.env.WEB_SOCKET);

const ERC721_Factory = new web3.eth.Contract(
  ABIs.ERC721FactoryAbi,
  process.env.ERC721_FACTORY_ADDRESS
);
const ERC1155_Factory = new web3.eth.Contract(
  ABIs.ERC1155FactoryAbi,
  process.env.ERC1155_FACTORY_ADDRESS
);
const ERC1155_FixedPriceFactory = new web3.eth.Contract(
  ABIs.ERC1155FixedPriceDropFactoryAbi,
  process.env.ERC1155_FIXED_PRICE_DROP_FACTORY_ADDRESS
);
const ERC1155_AuctionFactory = new web3.eth.Contract(
  ABIs.ERC1155AuctionDropFactoryAbi,
  process.env.ERC1155_AUCTION_DROP_FACTORY_ADDRESS
);
const ERC721_FixedPriceFactory = new web3.eth.Contract(
  ABIs.ERC721FixedPriceDropFactoryAbi,
  process.env.ERC721_FIXED_PRICE_DROP_FACTORY_ADDRESS
);
const ERC721_AuctionFactory = new web3.eth.Contract(
  ABIs.ERC721AuctionDropFactoryAbi,
  process.env.ERC721_AUCTION_DROP_FACTORY_ADDRESS
);

provider.on("error", (e) => {
  console.log("WS Error", e);
  provider = new web3.providers.WebsocketProvider(process.env.WEB_SOCKET);
});
provider.on("end", (e) => {
  console.log("WS closed");
  console.log("Attempting to reconnect...");
  provider = new web3.providers.WebsocketProvider(process.env.WEB_SOCKET);

  provider.on("connect", function () {
    console.log("WSS Reconnected");
  });

  // web3js.setProvider(provider);
});

// setInterval(async function (){
// 		console.log("Is listening : ",await web3.eth.net.isListening())
// 	},20000)

const listener = async () => {
  // console.log("Is listening : ",await web3.eth.net.isListening())

  // ERC721_Factory.events.CloneCreated(async function (error, event) {
  // 	try {
  // 		console.log("ERC721_Factory Event: ", event);

  // 		var newEvent = await collectionModel.updateOne(
  // 			{ txHash: event.transactionHash },
  // 			{
  // 				cloneId: event.returnValues.cloneId,
  // 				nftContractAddress: event.returnValues.cloneAddress,
  // 				contractType: "721",
  // 				isDeployed: true,
  // 			}
  // 		);
  // 		if (!newEvent) {
  // 			throw new Error("This collection does not exists");
  // 		}
  // 	} catch (error) {
  // 		console.log("Error " + error.name + ":" + error.message);
  // 	}
  // });

  // ERC1155_Factory.events.CloneCreated(async function (error, event) {
  // 	try {
  // 		console.log("ERC1155_Factory Event: ", event);

  // 		let newEvent = await collectionModel.updateOne(
  // 			{ txHash: event.transactionHash },
  // 			{
  // 				cloneId: event.returnValues.cloneId,
  // 				nftContractAddress: event.returnValues.cloneAddress,
  // 				contractType: "1155",
  // 				isDeployed: true,
  // 			}
  // 		);
  // 		if (!newEvent) {
  // 			throw new Error("This collection does not exists");
  // 		}
  // 	} catch (error) {
  // 		console.log("Error " + error.name + ":" + error.message);
  // 	}
  // });

  ERC1155_FixedPriceFactory.events.DropCreated(async (err, event) => {
    try {
      console.log(
        "Fixed-price(1155) event occured, return values are: ",
        event.returnValues
      );

      const fixedPrice = await DropModel.updateOne(
        { txHash: event.transactionHash },
        {
          dropCloneAddress: event.returnValues.cloneAddress,
          isCreatedOnBlockchain: true,
        }
      );
      console.log("fixed-price(1155) event updation result: ", fixedPrice);
    } catch (err) {
      console.log("Error " + err.name + ": " + err.message);
    }
  });

  ERC1155_AuctionFactory.events.AuctionDropCreated(async (err, event) => {
    try {
      console.log(
        "Auction(1155) event occured, return values are: ",
        event.returnValues
      );

      const auction = await DropModel.updateOne(
        { txHash: event.transactionHash },
        {
          dropCloneAddress: event.returnValues.cloneAddress,
          isCreatedOnBlockchain: true,
        }
      );
      console.log("auction(1155) event upadation result: ", auction);
    } catch (err) {
      console.log("Error " + err.name + ": " + err.message);
    }
  });

  ERC721_FixedPriceFactory.events.DropCreated(async (err, event) => {
    try {
      console.log(
        "Fixed-price(721) event occured, return values are: ",
        event.returnValues
      );

      const fixedPrice = await DropModel.updateOne(
        { txHash: event.transactionHash },
        {
          dropCloneAddress: event.returnValues.cloneAddress,
          isCreatedOnBlockchain: true,
        }
      );
      console.log("fixed-price(721) event updation result: ", fixedPrice);
    } catch (err) {
      console.log("Error " + err.name + ": " + err.message);
    }
  });

  ERC721_AuctionFactory.events.AuctionDropCreated(async (err, event) => {
    try {
      console.log(
        "Auction(721) event occured, return values are: ",
        event.returnValues
      );

      const auction = await DropModel.updateOne(
        { txHash: event.transactionHash },
        {
          dropCloneAddress: event.returnValues.cloneAddress,
          isCreatedOnBlockchain: true,
        }
      );
      console.log("auction(721) event upadation result: ", auction);
    } catch (err) {
      console.log("Error " + err.name + ": " + err.message);
    }
  });
};

module.exports.listener = listener;
