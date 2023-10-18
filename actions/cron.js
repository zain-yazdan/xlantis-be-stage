const cron = require("node-cron");
const Web3 = require("web3");
var web3 = new Web3();
web3.setProvider(process.env.WEB_SOCKET);

const DropModel = require("../models/DropModel");
const NFTModel = require("../models/NFTModel");

// const V2DropModel = require('../models/DropModel')

cron.schedule(process.env.CRON_JOB_EXPRESSION, async () => {
  let pendingDrops = await DropModel.find({ status: "pending" }).select(
    "startTime"
  );
  let nftIds;
  for (let i = 0; i < pendingDrops.length; ++i) {
    nftIds = pendingDrops[i].NFTIds;
    if (pendingDrops[i].startTime <= new Date()) {
      pendingDrops[i].status = "active";
      await NFTModel.updateMany(
        {
          _id: {
            $in: nftIds,
          },
        },
        {
          isOnSale: true,
        }
      );
      await pendingDrops[i].save();
      console.log(`Drop with id ${pendingDrops[i]._id} activated`);
    }
  }
});

cron.schedule(process.env.CRON_JOB_EXPRESSION, async () => {
  let activeDrops = await DropModel.find({ status: "active" }).select(
    "endTime"
  );
  let nftIds;
  for (let i = 0; i < activeDrops.length; ++i) {
    nftIds = activeDrops[i].NFTIds;
    if (activeDrops[i].endTime <= new Date()) {
      activeDrops[i].status = "closed";
      await NFTModel.updateMany(
        {
          _id: {
            $in: nftIds,
          },
        },
        {
          isOnSale: false,
        }
      );
      await activeDrops[i].save();
      console.log(`Drop with id ${activeDrops[i]._id} closed`);
    }
  }
});

// cron.schedule(process.env.CRON_JOB_EXPRESSION, async () => {
//     let pendingDrops = await V2DropModel.find({status: 'pending'}).select('startTime');
//     for (let i = 0; i < pendingDrops.length ; ++i) {
//         if (pendingDrops[i].startTime <= new Date()){
//             pendingDrops[i].status = 'active';
//             await pendingDrops[i].save();
//             console.log(`Drop with id ${pendingDrops[i]._id} activated`);
//         }
//     }
// });

// cron.schedule(process.env.CRON_JOB_EXPRESSION, async () => {
//     let activeDrops = await V2DropModel.find({status: 'active'}).select('endTime');

//     for (let i = 0; i < activeDrops.length ; ++i) {
//         if (activeDrops[i].endTime <= new Date()){
//             activeDrops[i].status = 'closed';
//             await activeDrops[i].save();
//             console.log(`Drop with id ${activeDrops[i]._id} closed`);
//         }
//     }
// });

cron.schedule(process.env.CRON_JOB_EXPRESSION, async () => {
  // console.log("Is listening : ",await web3.eth.net.isListening())
  await web3.eth.net.isListening();
});

// cron.schedule("*/10 * * * * *", async () => {
// 	console.log("Cron job listening : ")
// });
