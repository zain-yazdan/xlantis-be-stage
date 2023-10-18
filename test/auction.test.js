const chai = require("chai");
const chaiHttp = require("chai-http");
const mocha = require("mocha");
const mongoose = require("mongoose");
const MockDate = require("mockdate");

const server = require("../app");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const expect = chai.expect;
chai.use(chaiHttp);

// const VerifyEmail = require("../models/VerifyEmailModel");
const CollectionModel = require("../models/CollectionModel");
const DropModel = require("../models/DropModel");
const NFTModel = require("../models/NFTModel");
const OrderListingModel = require("../models/OrderListingModel");

if (process.env.NODE_MODE != "test") {
  throw 'To run the tests, NODE_MODE should be set to "test" in environment variables';
}

let JWT,
  tempJWT,
  requestBody,
  collectionId,
  existingFiles,
  nftId,
  bidLessNFT,
  bidId,
  nftIdForAuction,
  bidIdForAuction,
  dropId;
const directory = "public/uploads";

before(async () => {
  const CONNECTION_STRING = process.env.DATABASE_TESTING_URL;

  const isLocalhost = CONNECTION_STRING.startsWith("mongodb://localhost:27017");
  if (!isLocalhost) throw "To run the tests, connect to local mongo database";

  const connect = await mongoose.connect(CONNECTION_STRING);
  console.log("Connected to the MongoDB server");

  await connect.connection.db.dropDatabase();
  console.log("Connected database dropped");

  existingFiles = fs.readdirSync(directory);
  // console.log({existingFiles});
});

after(async () => {
  const files = fs.readdirSync(directory);
  MockDate.reset();

  const removeFiles = files.filter((file) => {
    return existingFiles.indexOf(file) === -1;
  });
  // console.log({removeFiles});

  for (const file of removeFiles) {
    fs.unlink(path.join(directory, file), (err) => {
      if (err) throw err;
    });
  }
  // console.log(`Files created in directory ${directory} safely removed`);
});

describe("Test auction router", () => {
  describe("Create a new user, collection and NFT and login that user", () => {
    it("should verify server is running", (done) => {
      chai
        .request(server)
        .get("/is-live")
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.text).to.be.eq("Server is live and running!");
          done();
        });
    });
    it("should create and login new user", (done) => {
      requestBody = {
        walletAddress: "0xA0899ead09Fba22578408551d9023F04865aA1f9",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/user/auth/admin-login")
        .send(requestBody)
        .end((err, res) => {
          // console.log(res)
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body).to.have.property("raindropToken");
          expect(res.body.message).to.be.eq(
            "New admin created. Awaiting super-admin approval"
          );
          JWT = res.body.raindropToken;
          done();
        });
    });

    it("should create and login another new user", (done) => {
      requestBody = {
        walletAddress: "0xFa66506c0f3D6652e5f3312AA20C7c550A4c7c3E",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/user/auth/admin-login")
        .send(requestBody)
        .end((err, res) => {
          // console.log(res)
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body).to.have.property("raindropToken");
          expect(res.body.message).to.be.eq(
            "New admin created. Awaiting super-admin approval"
          );
          tempJWT = res.body.raindropToken;
          done();
        });
    });

    it("should create a new collection", (done) => {
      requestBody = {
        name: "Armada",
        symbol: "JS",
        description:
          "This is test collection for an armada owner by the great Captain Jack Sparrow, Savy!?",
        contractType: "1155",
      };

      chai
        .request(server)
        .post("/collection/")
        .auth(JWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .field("name", requestBody.name)
        .field("symbol", requestBody.symbol)
        .field("description", requestBody.description)
        .field("contractType", requestBody.contractType)
        .attach("thumbnail", "test/stub1.txt")
        .query({
          userType: "v2",
        })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("collection");
          expect(res.body.message).to.be.eq("Collection created successfully!");
          collectionId = res.body.collection._id;
          done();
        });
    });

    it("should add 3 new NFTs to a collection", (done) => {
      requestBody = {
        collectionId,
        data: [
          {
            title: "Black Pearl",
            type: "Rare",
            nftFormat: "png",
            nftURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pearl.png",
            metadataURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pearl.json",
            tokenSupply: 1,
            supplyType: "Single",
            properties: {
              speed: "Fastest ship ever",
            },
          },
          {
            title: "The Dutchman",
            type: "Rare",
            nftFormat: "png",
            nftURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dutchman.png",
            metadataURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dutchman.json",
          },
          {
            title: "The Temporary NFT",
            type: "Rare",
            nftFormat: "mp3",
            nftURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/temporary.mp3",
            metadataURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/temporary.json",
            previewImageURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/temporary.jpg",
          },
        ],
      };

      chai
        .request(server)
        .post("/nft/addNFTs")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq(
            "NFT(s) added succesfully, awaiting minting from blockchain!"
          );
          done();
        });
    });
    it("should create the drop", (done) => {
      requestBody = {
        title: "Fancy Drop",
        image: "https://ipfs/pretty-uri",
        description:
          "This is a v special drop, created for one Mr Jack Sparrow",
        startTime: Date.now() + 5000,
        endTime: Date.now() + 86400000,
        saleType: "auction",
        dropType: "1155",
        bannerURL: "s3-banner-url",
      };

      chai
        .request(server)
        .post("/drop/")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("dropId");
          expect(res.body.success).to.be.equal(true);
          expect(res.body.message).to.be.equal("Drop created successfully!");
          dropId = res.body.dropId;
          done();
        });
    });
    it("should fetch collection from DB and save NFT Id(s)", async () => {
      const collection = await CollectionModel.findById(collectionId);
      expect(collection).to.have.property("_id");
      expect(collection).to.have.property("nftId");
      nftId = collection.nftId[0];
      bidLessNFT = collection.nftId[1];
      nftIdForAuction = collection.nftId[2];
      await CollectionModel.updateOne(
        {
          _id: collectionId,
        },
        {
          nftContractAddress: "0xFC61034C76aF487AeAe1D43a580Ca5DBBA748288",
        }
      );
      await DropModel.updateOne(
        {
          _id: dropId,
        },
        {
          dropCloneAddress: "0x73f1FB7fe588283383D44Be7FF0c5d24b442FD5d",
        }
      );
      // await NFTModel.updateOne({
      // 	_id: nftId
      // },{
      // 	dropId: dropId
      // })
      expect(nftId).to.be.eq(collection.nftId[0]);
      expect(bidLessNFT).to.be.eq(collection.nftId[1]);
      expect(nftIdForAuction).to.be.eq(collection.nftId[2]);
    });
  });
  describe("Testing route: /auction/bid [POST]", () => {
    it("should validate complete request body parameters are passed", (done) => {
      chai
        .request(server)
        .post("/auction/bid")
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "nftId not found in request body!"
          );
          done();
        });
    });
    it("should validate request body parameters are not passed empty", (done) => {
      requestBody = {
        nftId: "",
        bidAmount: "4000000000",
        expiryTime: "2023-10-17T03:24:00.000Z",
        bidderAddress: "0x3EDb32c1B0329B04Dfz6c54cF8Bb53855b4974f6",
      };

      chai
        .request(server)
        .post("/auction/bid")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "nftId was empty in request body!"
          );
          done();
        });
    });
    it("should validate bid does not end before it starts", (done) => {
      requestBody = {
        nftId: nftId,
        bidAmount: "4000000000",
        expiryTime: Date.now(),
        bidderAddress: "0x3EDb32c1B0329B04Dfz6c54cF8Bb53855b4974f6",
      };
      console.log({ requestBody });
      chai
        .request(server)
        .post("/auction/bid")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal("bid ends before it starts");
          done();
        });
    });
    it("should validate bidAmount is greater than 0", (done) => {
      requestBody = {
        nftId: nftId,
        bidAmount: "0",
        expiryTime: "2023-10-17T03:24:00.000Z",
        bidderAddress: "0x3EDb32c1B0329B04Dfz6c54cF8Bb53855b4974f6",
      };

      chai
        .request(server)
        .post("/auction/bid")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "bidAmount must be greater than 0!"
          );
          done();
        });
    });

    // it("should validate bidderAddress", (done) => {
    // 	requestBody = {
    // 		nftId: nftId,
    // 		bidAmount: "20000000000000",
    // 		expiryTime: "1764897877728",
    // 		bidderAddress: "3EDb32c1B0329B04Dfz6c54cF8Bb53855b4974f6",
    // 	};

    // 	chai
    // 		.request(server)
    // 		.post("/auction/bid")
    // 		.auth(JWT, { type: "bearer" })
    // 		.send(requestBody)
    // 		.query({
    // 			userType: "v2"
    // 		})
    // 		.end((err, res) => {
    // 			console.log(res.text)
    // 			expect(res).to.have.status(400);
    // 			expect(res.body.success).to.be.equal(false);
    // 			expect(res.body.message).to.be.equal("invalid address entered!");
    // 			done();
    // 		});
    // });
    it("should validate the NFT query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();
      requestBody = {
        nftId: fakeId,
        bidAmount: "20000000000000",
        expiryTime: "2023-10-17T03:24:00.000Z",
        bidderAddress: "0x2EDb32c1B0229B04Dff6c54cF8bB53855b4974f6",
      };

      chai
        .request(server)
        .post("/auction/bid")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .query({
          userType: "v2",
        })
        .end((err, res) => {
          console.log("res.body", res.body);
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "NFT not found against provided NFT Id!"
          );
          done();
        });
    });

    it("should add NFT to the drop", (done) => {
      requestBody = {
        nftId: nftId,
        dropId: dropId,
        price: "1000000000000000",
        supply: 2,
      };

      chai
        .request(server)
        .put("/drop/nft")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          console.log(res);
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.equal(true);
          expect(res.body.message).to.be.equal(
            "NFT added to drop successfully!"
          );
          done();
        });
    });

    it("should create the bid", (done) => {
      requestBody = {
        nftId: nftId,
        bidAmount: "20000000000000",
        expiryTime: "2023-10-17T03:24:00.000Z",
        bidderAddress: "0x2EDb32c1B0229B04Dff6c54cF8bB53855b4974f6",
      };

      chai
        .request(server)
        .post("/auction/bid")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .query({
          userType: "v2",
        })
        .end((err, res) => {
          console.log(res.body);
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.equal(true);
          expect(res.body).to.have.property("bidId");
          expect(res.body.message).to.be.equal("Bid placed successfully!");
          bidId = res.body.bidId;
          done();
        });
    });
  });
  describe("Testing route: /auction/:nftId/:start/:end [GET]", () => {
    it("should validate the NFT query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();

      chai
        .request(server)
        .get(`/auction/${fakeId}/${0}/${2}`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "NFT not found against provided NFT Id!"
          );
          done();
        });
    });
    it("should validate the Bid query from DB ", (done) => {
      console.log("bidLessNFT", bidLessNFT);
      chai
        .request(server)
        .get(`/auction/${bidLessNFT}/${0}/${2}`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "No bids were found against requested NFT!"
          );
          done();
        });
    });
    it("should get bids against the NFT", (done) => {
      chai
        .request(server)
        .get(`/auction/${nftId}/${0}/${1}`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.equal(true);
          expect(res.body).to.have.property("bids");
          expect(res.body.bids.length).to.be.equal(1);
          done();
        });
    });
  });
  describe("Testing route: /auction/bid/finalize [PUT]", () => {
    it("should validate complete request body parameters are passed", (done) => {
      chai
        .request(server)
        .put("/auction/bid/finalize")
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "bidId not found in request body."
          );
          done();
        });
    });
    it("should validate request body parameters are not passed empty", (done) => {
      requestBody = {
        bidId: "",
        txHash:
          "0x2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f",
      };

      chai
        .request(server)
        .put("/auction/bid/finalize")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "bidId was empty in request body."
          );
          done();
        });
    });
    it("should validate txHash in request body parameters", (done) => {
      requestBody = {
        bidId: bidId,
        txHash:
          "2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f",
      };

      chai
        .request(server)
        .put("/auction/bid/finalize")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "Invalid txHash sent in request body!"
          );
          done();
        });
    });
    it("should validate bid query from DB", (done) => {
      const fakeId = mongoose.Types.ObjectId();
      requestBody = {
        bidId: fakeId,
        txHash:
          "0x2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f",
      };

      chai
        .request(server)
        .put("/auction/bid/finalize")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "No bid found against provided bidId."
          );
          done();
        });
    });
    // it("should finalize the bid", (done) => {
    // 	requestBody = {
    // 		bidId: bidId,
    // 		txHash:
    // 			"0x2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f",
    // 	};

    // 	chai
    // 		.request(server)
    // 		.put("/auction/bid/finalize")
    // 		.auth(JWT, { type: "bearer" })
    // 		.send(requestBody)
    // 		.end((err, res) => {
    // 			console.log(res)
    // 			expect(res).to.have.status(200);
    // 			expect(res.body.success).to.be.equal(true);
    // 			expect(res.body.message).to.be.equal("Bid successfully finalized");
    // 			done();
    // 		});
    // });
    it("should verify that a finalize bid is not finalized again", (done) => {
      requestBody = {
        bidId: bidId,
        txHash:
          "0x2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f",
      };

      chai
        .request(server)
        .put("/auction/bid/finalize")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "Unable to finalize, bid is already activated or expired."
          );
          done();
        });
    });
  });
  describe("Testing route: /auction/bid/highest/:nftId [GET]", () => {
    it("should validate the NFT query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();

      chai
        .request(server)
        .get(`/auction/bid/highest/${fakeId}`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "NFT not found against provided NFT Id!"
          );
          done();
        });
    });
    it("should get highest bid against the NFT", (done) => {
      chai
        .request(server)
        .get(`/auction/bid/highest/${nftId}`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.equal(true);
          expect(res.body).to.have.property("highestBid");
          expect(res.body.highestBid).to.have.property("_id");
          expect(res.body.highestBid).to.have.property("bidAmount");
          expect(res.body.highestBid).to.have.property("expiryTime");
          expect(res.body.highestBid).to.have.property("status");
          done();
        });
    });
  });
  describe("Testing route: /auction/bids/:nftId/:start/:end [GET]", () => {
    it("should validate the NFT query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();

      chai
        .request(server)
        .get(`/auction/bids/${fakeId}/0/2`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "NFT not found against provided NFT Id!"
          );
          done();
        });
    });
    it("should validate the bids query from DB ", (done) => {
      chai
        .request(server)
        .get(`/auction/bids/${bidLessNFT}/0/2`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "No bid(s) found against requested NFT."
          );
          done();
        });
    });

    it("should get all pagianted bids against the NFT", (done) => {
      chai
        .request(server)
        .get(`/auction/bids/${nftId}/0/2`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.equal(true);
          expect(res.body).to.have.property("totalBids");
          expect(res.body.totalBids).to.be.equal(1);
          expect(res.body).to.have.property("data");
          expect(res.body.data[0]).to.have.property("_id");
          done();
        });
    });
  });

  describe("Testing route: /auction/bid/accept [POST]", () => {
    it("should validate complete request body parameters are passed", (done) => {
      chai
        .request(server)
        .post("/auction/bid/accept")
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "bidId not found in request body."
          );
          done();
        });
    });
    it("should validate request body parameters are not passed empty", (done) => {
      requestBody = {
        bidId: "",
        txHash:
          "0x2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f",
      };

      chai
        .request(server)
        .post("/auction/bid/accept")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "bidId was empty in request body."
          );
          done();
        });
    });
    // it("should validate request body txHash ", (done) => {
    // 	const fakeId = mongoose.Types.ObjectId();
    // 	requestBody = {
    // 		bidId: bidId,
    // 		txHash:
    // 			"2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f",
    // 	};

    // 	chai
    // 		.request(server)
    // 		.post("/auction/bid/accept")
    // 		.auth(JWT, { type: "bearer" })
    // 		.send(requestBody)
    // 		.end((err, res) => {
    // 			expect(res).to.have.status(400);
    // 			expect(res.body.success).to.be.equal(false);
    // 			expect(res.body.message).to.be.equal(
    // 				"Invalid txHash sent in request body!"
    // 			);
    // 			done();
    // 		});
    // });
    it("should validate the NFT query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();
      requestBody = {
        bidId: fakeId,
        txHash:
          "0x2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f",
      };

      chai
        .request(server)
        .post("/auction/bid/accept")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "No bid found against provided bidId."
          );
          done();
        });
    });

    // it("should add NFT to the drop", (done) => {
    // 	requestBody = {
    // 		nftId: nftId,
    // 		dropId: dropId,
    // 		price: "1000000000000000",
    // 		supply: 2,
    // 	};

    // 	chai
    // 		.request(server)
    // 		.put("/drop/nft")
    // 		.auth(JWT, { type: "bearer" })
    // 		.send(requestBody)
    // 		.end((err, res) => {
    // 			console.log(res)
    // 			expect(res).to.have.status(200);
    // 			expect(res.body.success).to.be.equal(true);
    // 			expect(res.body.message).to.be.equal(
    // 				"NFT added to drop successfully!"
    // 			);
    // 			done();
    // 		});
    // });

    it("should accept the bid", (done) => {
      requestBody = {
        bidId: bidId,
        txHash:
          "0x2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f",
      };

      chai
        .request(server)
        .post("/auction/bid/accept")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          console.log(res.body);
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.equal(true);
          expect(res.body.message).to.be.equal("Bid successfully accepted");
          done();
        });
    });
  });
});

describe("\nTesting route: /auction/nft/auction (POST)\n", () => {
  it("should call endpoint /is-live (GET) and verify server is running", (done) => {
    chai
      .request(server)
      .get("/is-live")
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.text).to.be.eq("Server is live and running!");
        done();
      });
  });

  it("should validate required attributes are passed as request body parameters", (done) => {
    requestBody = {
      nftId: nftIdForAuction,
    };

    chai
      .request(server)
      .post("/auction/nft/auction")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("price not found in request body!");
        done();
      });
  });

  it("should validate required attributes are not passed empty in request body", (done) => {
    requestBody = {
      nftId: "",
      price: 50,
      startTime: Date.now() + 5000,
      endTime: Date.now() + 8000000,
    };

    chai
      .request(server)
      .post("/auction/nft/auction")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("nftId was empty in request body!");
        done();
      });
  });

  it("should validate start bid must be greater than 0.", (done) => {
    requestBody = {
      nftId: nftIdForAuction,
      price: -50,
      startTime: Date.now() + 5000,
      endTime: Date.now() + 8000000,
    };

    chai
      .request(server)
      .post("/auction/nft/auction")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Start bid must be greater than 0.");
        done();
      });
  });

  it("should validate start time must be less then end time", (done) => {
    requestBody = {
      nftId: nftIdForAuction,
      price: 50,
      startTime: Date.now() + 5000,
      endTime: Date.now(),
    };

    chai
      .request(server)
      .post("/auction/nft/auction")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Start time should be less than the end time."
        );
        done();
      });
  });

  it("should validate start time must be from future", (done) => {
    requestBody = {
      nftId: nftIdForAuction,
      price: 50,
      startTime: Date.now() - 5000,
      endTime: Date.now() + 8000000,
    };

    chai
      .request(server)
      .post("/auction/nft/auction")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Start time should not be from the past."
        );
        done();
      });
  });

  it("should validate the nft query from DB ", (done) => {
    const randomObjectID = mongoose.Types.ObjectId();

    requestBody = {
      nftId: randomObjectID,
      price: 50,
      startTime: Date.now() + 5000,
      endTime: Date.now() + 8000000,
    };

    chai
      .request(server)
      .post("/auction/nft/auction")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("NFT not found against nft Id.");
        done();
      });
  });

  it("should validate the owner of nft", (done) => {
    requestBody = {
      nftId: nftIdForAuction,
      price: 50,
      startTime: Date.now() + 5000,
      endTime: Date.now() + 8000000,
    };

    chai
      .request(server)
      .post("/auction/nft/auction")
      .auth(tempJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Only Owner can put NFT on auction.");
        done();
      });
  });

  // POSITIVE CASE
  it(`should put nft on timed auction id ${nftIdForAuction}`, (done) => {
    requestBody = {
      nftId: nftIdForAuction,
      price: 50,
      startTime: Date.now() + 5000,
      endTime: Date.now() + 80000,
    };

    chai
      .request(server)
      .post("/auction/nft/auction")
      .send(requestBody)
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        console.log(res.body);
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("NFT successfully put on auction");
        done();
      });
  });

  // Negative CASE
  it(`should try to put nft on timed auction id again`, (done) => {
    requestBody = {
      nftId: nftIdForAuction,
      price: 50,
      startTime: Date.now() + 5000,
      endTime: Date.now() + 8000000,
    };

    chai
      .request(server)
      .post("/auction/nft/auction")
      .send(requestBody)
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("This NFT is already on sale.");
        done();
      });
  });
});

describe("\nTesting route: /auction/nft/bid (POST)\n", () => {
  it("should call endpoint /is-live (GET) and verify server is running", (done) => {
    chai
      .request(server)
      .get("/is-live")
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.text).to.be.eq("Server is live and running!");
        done();
      });
  });

  it("should validate required attributes are passed as request body parameters", (done) => {
    requestBody = {
      nftId: nftIdForAuction,
    };

    chai
      .request(server)
      .post("/auction/nft/bid")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "bidAmount not found in request body!"
        );
        done();
      });
  });

  it("should validate required attributes are not passed empty in request body", (done) => {
    requestBody = {
      nftId: "",
      bidAmount: 100,
      expiryTime: Date.now() + 50000,
    };

    chai
      .request(server)
      .post("/auction/nft/bid")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("nftId was empty in request body!");
        done();
      });
  });

  it("should validate the nft query from DB ", (done) => {
    const randomObjectID = mongoose.Types.ObjectId();

    requestBody = {
      nftId: randomObjectID,
      bidAmount: 100,
      expiryTime: Date.now(),
    };

    chai
      .request(server)
      .post("/auction/nft/bid")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("NFT not found against nft Id.");
        done();
      });
  });

  it("should validate the owner ability to bid on nft", (done) => {
    requestBody = {
      nftId: nftIdForAuction,
      bidAmount: 100,
      expiryTime: Date.now() + 50000,
    };

    chai
      .request(server)
      .post("/auction/nft/bid")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Owner cannot bid on his own NFT.");
        done();
      });
  });

  it("should fetch nft from DB and update sale Type", async () => {
    const nft = await NFTModel.findById(nftIdForAuction);
    await OrderListingModel.updateOne(
      { _id: nft.currentOrderListingId },
      { saleType: "fixed-price" }
    );
    const marketplace = await OrderListingModel.findById(
      nft.currentOrderListingId
    );
    expect(marketplace).to.have.property("_id");
    expect(marketplace).to.have.property("nftId");
    expect(marketplace.saleType).to.be.eq("fixed-price");
  });

  it("should validate the saleType of nft", (done) => {
    requestBody = {
      nftId: nftIdForAuction,
      bidAmount: 100,
      expiryTime: Date.now() + 50000,
    };

    chai
      .request(server)
      .post("/auction/nft/bid")
      .auth(tempJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Nft is not on timed auction.");
        done();
      });
  });

  it("should fetch nft from DB and update sale Type", async () => {
    const nft = await NFTModel.findById(nftIdForAuction);
    await OrderListingModel.updateOne(
      { _id: nft.currentOrderListingId },
      { saleType: "auction" }
    );
    const marketplace = await OrderListingModel.findById(
      nft.currentOrderListingId
    );
    expect(marketplace).to.have.property("_id");
    expect(marketplace).to.have.property("nftId");
    expect(marketplace.saleType).to.be.eq("auction");
  });

  it("should validate the start time of nft", (done) => {
    requestBody = {
      nftId: nftIdForAuction,
      bidAmount: 100,
      expiryTime: Date.now() + 50000,
    };

    chai
      .request(server)
      .post("/auction/nft/bid")
      .auth(tempJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Auction is not started yet.");
        done();
      });
  });

  it("should validate the bid value of nft", (done) => {
    requestBody = {
      nftId: nftIdForAuction,
      bidAmount: 10,
      expiryTime: Date.now() + 50000,
    };
    MockDate.set(Date.now() + 5000);
    chai
      .request(server)
      .post("/auction/nft/bid")
      .auth(tempJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Bid must be higher than the start bid."
        );
        done();
      });
  });
  it("should validate the expiry time of bid", (done) => {
    requestBody = {
      nftId: nftIdForAuction,
      bidAmount: 100,
      expiryTime: Date.now() - 50000,
    };
    chai
      .request(server)
      .post("/auction/nft/bid")
      .auth(tempJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Bid expiryTime should be greater than start time."
        );
        done();
      });
  });

  // POSITIVE CASE
  it(`should bid on nft id ${nftIdForAuction}`, (done) => {
    requestBody = {
      nftId: nftIdForAuction,
      bidAmount: 55,
      expiryTime: Date.now() + 50000,
    };

    chai
      .request(server)
      .post("/auction/nft/bid")
      .auth(tempJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("bidId");

        expect(res.body.message).to.be.eq("Bid added successfully.");
        bidIdForAuction = res.body.bidId;
        done();
      });
  });

  // Negative CASE
  // it(`should try to bid on nft lower than the previous amount id ${nftIdForAuction} again`, (done) => {
  // 	requestBody = {
  // 		nftId: nftIdForAuction,
  // 		bidAmount: 52,
  // 		expiryTime: Date.now() + 50000,
  // 	};

  // 	chai
  // 		.request(server)
  // 		.post("/auction/nft/bid")
  // 		.send(requestBody)
  // 		.auth(tempJWT, { type: "bearer" })
  // 		.end((err, res) => {
  // 			console.log("res : ");
  // 			expect(res).to.have.status(400);
  // 			expect(res.body.success).to.be.eq(false);
  // 			expect(res.body.message).to.be.eq(
  // 				"Bid must be higher then the previous bid."
  // 			);
  // 			done();
  // 		});
  // });
  it(`should try to bid on nft after auction end id ${nftIdForAuction} again`, (done) => {
    requestBody = {
      nftId: nftIdForAuction,
      bidAmount: 60,
      expiryTime: Date.now() + 50000,
    };
    MockDate.set(Date.now() + 80000);
    chai
      .request(server)
      .post("/auction/nft/bid")
      .send(requestBody)
      .auth(tempJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Auction is end now.");
        done();
      });
  });
});

describe("\nTesting route: /auction/nft/acceptBid (POST)\n", () => {
  it("should call endpoint /is-live (GET) and verify server is running", (done) => {
    chai
      .request(server)
      .get("/is-live")
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.text).to.be.eq("Server is live and running!");
        done();
      });
  });

  it("should validate required attributes are passed as request body parameters", (done) => {
    chai
      .request(server)
      .post(`/auction/nft/acceptBid`)
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("bidId not found in request body!");
        done();
      });
  });

  it("should validate required attributes are not passed empty in request body parameters", (done) => {
    requestBody = {
      bidId: "",
    };
    chai
      .request(server)
      .post(`/auction/nft/acceptBid`)
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("bidId was empty in request body!");
        done();
      });
  });
  it("should validate bidId from DB", (done) => {
    const fakeId = mongoose.Types.ObjectId();
    requestBody = {
      bidId: fakeId,
    };
    chai
      .request(server)
      .post(`/auction/nft/acceptBid`)
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "No bid found against provided bidId."
        );
        done();
      });
  });
  // it("should validate whether nft is on sale or not", (done) => {
  // 	chai
  // 		.request(server)
  // 		.post(`/auction/nft/acceptBid`)
  // 		.auth(JWT, { type: "bearer" })
  // 		.send(requestBody)
  // 		.end((err, res) => {
  // 			expect(res).to.have.status(400);
  // 			expect(res.body.success).to.be.eq(false);
  // 			expect(res.body.message).to.be.eq("Nft not found in marketplace.");
  // 			done();
  // 		});
  // });

  it("should fetch nft from DB and update sale Type", async () => {
    const nft = await NFTModel.findById(nftIdForAuction);
    await OrderListingModel.updateOne(
      { _id: nft.currentOrderListingId },
      { saleType: "fixed-price" }
    );
    const marketplace = await OrderListingModel.findById(
      nft.currentOrderListingId
    );
    expect(marketplace).to.have.property("_id");
    expect(marketplace).to.have.property("nftId");
    expect(marketplace.saleType).to.be.eq("fixed-price");
  });

  it("should validate the saleType of nft", (done) => {
    requestBody = {
      bidId: bidIdForAuction,
    };
    chai
      .request(server)
      .post(`/auction/nft/acceptBid`)
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Nft is not on timed auction.");
        done();
      });
  });

  it("should fetch nft from DB and update sale Type", async () => {
    const nft = await NFTModel.findById(nftIdForAuction);
    await OrderListingModel.updateOne(
      { _id: nft.currentOrderListingId },
      { saleType: "auction" }
    );
    const marketplace = await OrderListingModel.findById(
      nft.currentOrderListingId
    );
    expect(marketplace).to.have.property("_id");
    expect(marketplace).to.have.property("nftId");
    expect(marketplace.saleType).to.be.eq("auction");
  });

  it("should validate the start time of nft", (done) => {
    requestBody = {
      bidId: bidIdForAuction,
    };
    MockDate.reset();
    chai
      .request(server)
      .post(`/auction/nft/acceptBid`)
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Auction is not started yet.");
        done();
      });
  });

  it("should validate the end time of nft", (done) => {
    requestBody = {
      bidId: bidIdForAuction,
    };
    MockDate.set(Date.now() + 5000);
    chai
      .request(server)
      .post(`/auction/nft/acceptBid`)
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Auction is not end.");
        done();
      });
  });
  it("should validate owner ability to accept the bid.", (done) => {
    requestBody = {
      bidId: bidIdForAuction,
    };
    MockDate.set(Date.now() + 80000);
    chai
      .request(server)
      .post(`/auction/nft/acceptBid`)
      .auth(tempJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Only Owner can accept the bid on his NFT."
        );
        done();
      });
  });

  // it("should create and login new user", (done) => {
  // 	requestBody = {
  // 		walletAddress: "0xA0899ead09Fba22578408551d9023F04865aA1f9",
  // 	};

  // 	chai
  // 		.request(server)
  // 		.post("/user/login")
  // 		.send(requestBody)
  // 		.end((err, res) => {
  // 			expect(res).to.have.status(200);
  // 			expect(res.body.success).to.be.eq(true);
  // 			expect(res.body).to.have.property("userId");
  // 			expect(res.body).to.have.property("token");
  // 			expect(res.body).to.have.property("roles");
  // 			expect(res.body.isNewUser).to.be.eq(true);
  // 			expect(res.body.message).to.be.eq("User created and logged in");
  // 			tempJWT2 = res.body.token;
  // 			done();
  // 		});
  // });
  // it(`should validate the highest bidder address`, (done) => {
  // 	MockDate.set(Date.now() + 80000);

  // 	chai
  // 		.request(server)
  // 		.post(`/auction/nft/acceptBid`)
  // 		.auth(tempJWT2, { type: "bearer" })
  // 		.send(requestBody)
  // 		.end((err, res) => {
  // 			expect(res).to.have.status(400);
  // 			expect(res.body.success).to.be.eq(false);
  // 			expect(res.body.message).to.be.eq(
  // 				"Only the person with highest bid can claim NFT."
  // 			);
  // 			done();
  // 		});
  // });

  // POSITIVE CASE
  it(`should accept the bid on nft put on auction`, (done) => {
    requestBody = {
      bidId: bidIdForAuction,
    };
    MockDate.set(Date.now() + 80000);
    chai
      .request(server)
      .post(`/auction/nft/acceptBid`)
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        console.log("res : ", res.body);
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("Bid accepted successfully.");
        done();
      });
  });

  // it(`should put nft on timed auction id ${nftIdForAuction}`, (done) => {
  // 	requestBody = {
  // 		nftId: nftIdForAuction,
  // 		price: 50,
  // 		startTime: Date.now() + 5000,
  // 		endTime: Date.now() + 80000,
  // 	};

  // 	chai
  // 		.request(server)
  // 		.post("/auction/nft/auction")
  // 		.send(requestBody)
  // 		.auth(tempJWT, { type: "bearer" })
  // 		.end((err, res) => {
  // 			expect(res).to.have.status(200);
  // 			expect(res.body.success).to.be.eq(true);
  // 			expect(res.body.message).to.be.eq("NFT successfully put on auction");
  // 			done();
  // 		});
  // });

  // Negative CASE
  it(`should try to accept the same bid on nft again`, (done) => {
    requestBody = {
      bidId: bidIdForAuction,
    };
    chai
      .request(server)
      .post(`/auction/nft/acceptBid`)
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        console.log("res : ", res.body);
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Bid is already accepted.");
        done();
      });
  });

  // it(`should validate owner to claim nft when no one bid on that`, (done) => {
  // 	MockDate.set(Date.now() + 5000 + 80000);
  // 	chai
  // 		.request(server)
  // 		.post(`/auction/nft/acceptBid`)
  // 		.auth(tempJWT2, { type: "bearer" })
  // 		.send(requestBody)
  // 		.end((err, res) => {
  // 			expect(res).to.have.status(400);
  // 			expect(res.body.success).to.be.eq(false);
  // 			expect(res.body.message).to.be.eq("Only owner can claim NFT.");
  // 			done();
  // 		});
  // });
  // POSITIVE CASE
  // it(`should bid on nft id ${nftIdForAuction}`, (done) => {
  // 	chai
  // 		.request(server)
  // 		.post(`/auction/nft/acceptBid`)
  // 		.auth(tempJWT, { type: "bearer" })
  // 		.send(requestBody)
  // 		.end((err, res) => {
  // 			expect(res).to.have.status(200);
  // 			expect(res.body.success).to.be.eq(true);
  // 			expect(res.body.message).to.be.eq("Bid added successfully.");
  // 			done();
  // 		});
  // });
});
