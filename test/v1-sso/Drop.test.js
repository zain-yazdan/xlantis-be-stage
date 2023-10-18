const chai = require("chai");
const chaiHttp = require("chai-http");
const mocha = require("mocha");
const mongoose = require("mongoose");
const server = require("../app");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const expect = chai.expect;
chai.use(chaiHttp);

// const VerifyEmail = require("../models/VerifyEmailModel");
const CollectionModel = require("../models/CollectionModel");
const NFTModel = require("../models/NFTModel");
const DropModel = require("../models/DropModel");

if (process.env.NODE_MODE != "testing") {
  throw 'To run the tests, NODE_MODE should be set to "testing" in environment variables';
}

let JWT,
  tempJWT,
  requestBody,
  existingFiles,
  collectionId,
  nftId,
  dropId,
  droplessNFT,
  tempDropId;
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
  console.log({ existingFiles });
});

after(async () => {
  const files = fs.readdirSync(directory);

  const removeFiles = files.filter((file) => {
    return existingFiles.indexOf(file) === -1;
  });
  console.log({ removeFiles });

  for (const file of removeFiles) {
    fs.unlink(path.join(directory, file), (err) => {
      if (err) throw err;
    });
  }
  console.log(`Files created in directory ${directory} safely removed`);
});

describe("Test drop router", () => {
  describe("Create a new user and login ", () => {
    it("should verify server is running", (done) => {
      chai
        .request(server)
        .get("/v1-sso/is-live")
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
          console.log(res);
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

    it("should create and login new user", (done) => {
      requestBody = {
        walletAddress: "0xFa66506c0f3D6652e5f3312AA20C7c550A4c7c3E",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/user/auth/admin-login")
        .send(requestBody)
        .end((err, res) => {
          console.log(res);
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
  });
  describe("Testing route: /drop/ [POST]", () => {
    it("should validate complete request body parameters are passed", (done) => {
      chai
        .request(server)
        .post("/v1-sso/drop/")
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "title not found in request body!"
          );
          done();
        });
    });
    it("should validate request body parameters are not passed empty", (done) => {
      requestBody = {
        title: "",
        image: "https://ipfs/pretty-uri",
        description:
          "This is a v special drop, created for one Mr Jack Sparrow",
        startTime: Date.now(),
        endTime: Date.now() + 86400000,
        saleType: "auction",
        dropType: "721",
      };
      chai
        .request(server)
        .post("/v1-sso/drop/")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "title was empty in request body!"
          );
          done();
        });
    });
    it("should validate drop does not ends before it starts", (done) => {
      requestBody = {
        title: "Fancy Drop",
        image: "https://ipfs/pretty-uri",
        description:
          "This is a v special drop, created for one Mr Jack Sparrow",
        startTime: Date.now(),
        endTime: Date.now() - 86400000,
        saleType: "auction",
        dropType: "721",
      };
      chai
        .request(server)
        .post("/v1-sso/drop/")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "Invalid start time provided, drop ends before it starts"
          );
          done();
        });
    });
    it("should validate drop start time is not a time from past", (done) => {
      requestBody = {
        title: "Fancy Drop",
        image: "https://ipfs/pretty-uri",
        description:
          "This is a v special drop, created for one Mr Jack Sparrow",
        startTime: Date.now() - 86400000,
        endTime: Date.now() + 86400000,
        saleType: "auction",
        dropType: "721",
      };
      chai
        .request(server)
        .post("/v1-sso/drop/")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "Start time of Drop can not be from past"
          );
          done();
        });
    });
    it("should validate saleType", (done) => {
      requestBody = {
        title: "Fancy Drop",
        image: "https://ipfs/pretty-uri",
        description:
          "This is a v special drop, created for one Mr Jack Sparrow",
        startTime: Date.now() + 5000,
        endTime: Date.now() + 86400000,
        saleType: "fake-saleType",
        dropType: "721",
      };
      chai
        .request(server)
        .post("/v1-sso/drop/")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "request body input for saleType field in is not defined in saleType enum for Drop Schema!"
          );
          done();
        });
    });
    it("should validate collectionType", (done) => {
      requestBody = {
        title: "Fancy Drop",
        image: "https://ipfs/pretty-uri",
        description:
          "This is a v special drop, created for one Mr Jack Sparrow",
        startTime: Date.now() + 5000,
        endTime: Date.now() + 86400000,
        saleType: "auction",
        dropType: "fake-dropType",
      };
      chai
        .request(server)
        .post("/v1-sso/drop/")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "request body input for dropType field in is not defined in dropType enum for drop schema"
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
        dropType: "721",
      };

      chai
        .request(server)
        .post("/v1-sso/drop/")
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
  });
  describe("Testing route: /drop/:dropId [GET]", () => {
    it("should validate the drop query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();

      chai
        .request(server)
        .get("/v1-sso/drop/" + fakeId)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal("Drop not found");
          done();
        });
    });

    it("should fetch drop data", (done) => {
      chai
        .request(server)
        .get("/v1-sso/drop/" + dropId)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("dropData");
          expect(res.body.success).to.be.equal(true);
          done();
        });
    });
  });

  describe("Testing route: /drop/nft [PUT]", () => {
    it("should create a new collection", (done) => {
      requestBody = {
        name: "Armada",
        symbol: "JS",
        description:
          "This is test collection for an armada owner by the great Captain Jack Sparrow, Savy!?",
      };

      chai
        .request(server)
        .post("/v1-sso/collection/")
        .auth(JWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .field("name", requestBody.name)
        .field("symbol", requestBody.symbol)
        .field("description", requestBody.description)
        .attach("thumbnail", "test/stub1.txt")
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("collection");
          expect(res.body.message).to.be.eq("Collection created successfully!");
          collectionId = res.body.collection._id;
          done();
        });
    });
    it("should add a NFTs in created collection", (done) => {
      requestBody = {
        collectionId,
        data: [
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
            title: "Dummy",
            type: "Rare",
            nftFormat: "png",
            nftURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dummy.png",
            metadataURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dummy.json",
          },
        ],
      };

      chai
        .request(server)
        .post("/v1-sso/nft/addNFTs")
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
    it("should fetch collection from DB and save NFT Id(s)", async () => {
      const collection = await CollectionModel.findById(collectionId);
      nftId = collection.nftId[0];
      droplessNFT = collection.nftId[1];
      expect(collection).to.have.property("_id");
      expect(collection).to.have.property("nftId");
      expect(nftId).to.be.eq(collection.nftId[0]);
      expect(droplessNFT).to.be.eq(collection.nftId[1]);
    });
    it("should validate complete request body parameters are passed", (done) => {
      chai
        .request(server)
        .put("/v1-sso/drop/nft")
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("nftId not found in request body!");
          done();
        });
    });
    it("should validate request body parameters are not sent empty passed", (done) => {
      requestBody = {
        nftId: "",
        dropId: dropId,
        price: "1000000000000000",
        supply: 1,
      };

      chai
        .request(server)
        .put("/v1-sso/drop/nft")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("nftId was empty in request body!");
          done();
        });
    });
    it("should validate supply in request body parameters", (done) => {
      requestBody = {
        nftId: nftId,
        dropId: dropId,
        price: "1000000000000000",
        supply: 0,
      };

      chai
        .request(server)
        .put("/v1-sso/drop/nft")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("supply must be 1 or greater!");
          done();
        });
    });
    it("should validate price in request body parameters", (done) => {
      requestBody = {
        nftId: nftId,
        dropId: dropId,
        price: "0",
        supply: 2,
      };

      chai
        .request(server)
        .put("/v1-sso/drop/nft")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("price must be greater than 0!");
          done();
        });
    });
    it("should validate the drop query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();
      requestBody = {
        nftId: nftId,
        dropId: fakeId,
        price: "1000000000000000",
        supply: 2,
      };

      chai
        .request(server)
        .put("/v1-sso/drop/nft")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "Drop not found against provided Drop Id!"
          );
          done();
        });
    });
    it("should validate the NFT query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();
      requestBody = {
        nftId: fakeId,
        dropId: dropId,
        price: "1000000000000000",
        supply: 2,
      };

      chai
        .request(server)
        .put("/v1-sso/drop/nft")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
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
        .put("/v1-sso/drop/nft")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.equal(true);
          expect(res.body.message).to.be.equal(
            "NFT added to drop successfully!"
          );
          done();
        });
    });
    it("should validate if NFT already assigned to requested drop", (done) => {
      requestBody = {
        nftId: nftId,
        dropId: dropId,
        price: "1000000000000000",
        supply: 2,
      };

      chai
        .request(server)
        .put("/v1-sso/drop/nft")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "NFT is already assigned to requested Drop!"
          );
          done();
        });
    });

    it("should create a secondary drop", (done) => {
      requestBody = {
        title: "Temp Drop",
        image: "https://ipfs/temp-uri",
        description: "This is a temp drop, created for one Mr Jack Sparrow",
        startTime: Date.now() + 5000,
        endTime: Date.now() + 86400000,
        saleType: "auction",
        dropType: "721",
      };

      chai
        .request(server)
        .post("/v1-sso/drop/")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("dropId");
          expect(res.body.success).to.be.equal(true);
          expect(res.body.message).to.be.equal("Drop created successfully!");
          tempDropId = res.body.dropId;
          done();
        });
    });
    it("should update NFT.dropId", async () => {
      const filter = { _id: nftId };
      const updation = { $set: { dropId: tempDropId } };
      const report = await NFTModel.updateOne(filter, updation);
      expect(report.acknowledged).to.be.equal(true);
      expect(report.matchedCount).to.be.equal(1);
      expect(report.modifiedCount).to.be.equal(1);
    });
    it("should validate if NFT already assigned to another drop", (done) => {
      requestBody = {
        nftId: nftId,
        dropId: dropId,
        price: "1000000000000000",
        supply: 2,
      };

      chai
        .request(server)
        .put("/v1-sso/drop/nft")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "NFT is already assigned to another Drop!"
          );
          done();
        });
    });
    it("should restore NFT.dropId", async () => {
      const filter = { _id: nftId };
      const updation = { $set: { dropId: dropId } };
      const report = await NFTModel.updateOne(filter, updation);
      expect(report.acknowledged).to.be.equal(true);
      expect(report.matchedCount).to.be.equal(1);
      expect(report.modifiedCount).to.be.equal(1);
    });
    it("should update Drop.status", async () => {
      const filter = { _id: dropId };
      const updation = { $set: { status: "pending" } };
      const report = await DropModel.updateOne(filter, updation);
      expect(report.acknowledged).to.be.equal(true);
      expect(report.matchedCount).to.be.equal(1);
      expect(report.modifiedCount).to.be.equal(1);
    });
    it("should validate if drop is in editable state or not", (done) => {
      requestBody = {
        nftId: nftId,
        dropId: dropId,
        price: "1000000000000000",
        supply: 2,
      };

      chai
        .request(server)
        .put("/v1-sso/drop/nft")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          console.log(res.body);
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "Unable to add NFT to drop, Drop is not in editable state!"
          );
          done();
        });
    });
    it("should restore Drop.status", async () => {
      const filter = { _id: dropId };
      const updation = { $set: { status: "draft" } };
      const report = await DropModel.updateOne(filter, updation);
      expect(report.acknowledged).to.be.equal(true);
      expect(report.matchedCount).to.be.equal(1);
      expect(report.modifiedCount).to.be.equal(1);
    });
  });
  describe("Testing route: /drop/:status/:start/:end [GET]", () => {
    it("should validate the status passed in request param", (done) => {
      chai
        .request(server)
        .get("/v1-sso/drop/:fake/:0/:2")
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            " Requested param is not present in Drop schema!"
          );
          done();
        });
    });
    it("should validate DB query which fetches no data", (done) => {
      chai
        .request(server)
        .get("/v1-sso/drop/closed/0/2")
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "No drops were found against provided status!"
          );
          done();
        });
    });
    it("should fetch drop data with draft status", (done) => {
      chai
        .request(server)
        .get("/v1-sso/drop/draft/0/4")
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("data");
          expect(res.body.success).to.be.equal(true);
          expect(res.body.data.length).to.be.equal(2);
          done();
        });
    });
  });

  // describe('Testing route: /drop/status/pending [PUT]', ()=>{
  //     it ('should validate complete request body parameters are passed', (done) => {
  //         chai.request(server)
  //         .put('/v1-sso/drop/status/pending')
  //         .auth(JWT, { type: 'bearer' })
  //         .end((err, res) => {
  //             expect(res).to.have.status(400);
  //             expect(res.body.success).to.be.eq(false);
  //             expect(res.body.message).to.be.eq('dropId not found in request body!');
  //             done();
  //         });
  //     });
  //     it ('should validate request body parameters are not sent empty passed', (done) => {
  //         requestBody = {
  //             dropId: ''
  //         }

  //         chai.request(server)
  //         .put('/v1-sso/drop/status/pending')
  //         .auth(JWT, { type: 'bearer' })
  //         .send(requestBody)
  //         .end((err, res) => {
  //             expect(res).to.have.status(400);
  //             expect(res.body.success).to.be.eq(false);
  //             expect(res.body.message).to.be.eq('dropId was empty in request body!');
  //             done();
  //         });
  //     });
  //     it('should validate the drop query from DB ', (done) => {
  //         const fakeId = mongoose.Types.ObjectId();
  //         requestBody = {
  //             dropId: fakeId,
  //         }

  //         chai.request(server)
  //         .put('/v1-sso/drop/status/pending')
  //         .auth(JWT, {type: 'bearer'})
  //         .send(requestBody)
  //         .end((err, res) => {
  //             expect(res).to.have.status(404);
  //             expect(res.body.success).to.be.equal(false);
  //             expect(res.body.message).to.be.equal('Drop not found against provided Drop Id!');
  //             done();
  //         });
  //     });
  //     it('should update Drop.status', async() => {
  //         const filter = {_id: dropId};
  //         const updation = {$set: {status: 'pending'}};
  //         const report = await DropModel.updateOne(filter, updation);

  //         expect(report.acknowledged).to.be.equal(true);
  //         expect(report.matchedCount).to.be.equal(1);
  //         expect(report.modifiedCount).to.be.equal(1);
  //     });
  //     it('should validate if drop is in editable state or not', (done) => {
  //         requestBody = {
  //             dropId: dropId,
  //         }

  //         chai.request(server)
  //         .put('/v1-sso/drop/status/pending')
  //         .auth(JWT, {type: 'bearer'})
  //         .send(requestBody)
  //         .end((err, res) => {
  //             console.log(res.body);
  //             expect(res).to.have.status(400);
  //             expect(res.body.success).to.be.equal(false);
  //             expect(res.body.message).to.be.equal
  //             ('Unable to update drop status, Drop is not in editable state!');
  //             done();
  //         });
  //     });
  //     it('should restore Drop.status', async() => {
  //         const filter = {_id: dropId};
  //         const updation = {$set: {status: 'draft'}};
  //         const report = await DropModel.updateOne(filter, updation);

  //         expect(report.acknowledged).to.be.equal(true);
  //         expect(report.matchedCount).to.be.equal(1);
  //         expect(report.modifiedCount).to.be.equal(1);
  //     });
  //     it('should update drop status to pending', (done) => {
  //         requestBody = {
  //             dropId: dropId,
  //         }

  //         chai.request(server)
  //         .put('/v1-sso/drop/status/pending')
  //         .auth(JWT, {type: 'bearer'})
  //         .send(requestBody)
  //         .end((err, res) => {
  //             console.log(res.body);
  //             expect(res).to.have.status(200);
  //             expect(res.body.success).to.be.equal(true);
  //             expect(res.body.message).to.be.equal
  //             ('Drop successfully finalized awaiting blockchain event!');
  //             done();
  //         });
  //     });
  // });

  // describe('Testing route: /drop/txHash [PUT]', ()=>{
  //     it ('should validate complete request body parameters are passed', (done) => {
  //         chai.request(server)
  //         .put('/v1-sso/drop/txHash')
  //         .auth(JWT, { type: 'bearer' })
  //         .end((err, res) => {
  //             expect(res).to.have.status(400);
  //             expect(res.body.success).to.be.eq(false);
  //             expect(res.body.message).to.be.eq('dropId not found in request body!');
  //             done();
  //         });
  //     });
  //     it ('should validate request body parameters are not sent empty passed', (done) => {
  //         requestBody = {
  //             dropId: '',
  //             txHash: '0x2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f'
  //         }

  //         chai.request(server)
  //         .put('/v1-sso/drop/txHash')
  //         .auth(JWT, { type: 'bearer' })
  //         .send(requestBody)
  //         .end((err, res) => {
  //             expect(res).to.have.status(400);
  //             expect(res.body.success).to.be.eq(false);
  //             expect(res.body.message).to.be.eq('dropId was empty in request body!');
  //             done();
  //         });
  //     });
  //     it('should validate the drop query from DB ', (done) => {
  //         const fakeId = mongoose.Types.ObjectId();
  //         requestBody = {
  //             dropId: fakeId,
  //             txHash: '0x2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f'
  //         }

  //         chai.request(server)
  //         .put('/v1-sso/drop/txHash')
  //         .auth(JWT, {type: 'bearer'})
  //         .send(requestBody)
  //         .end((err, res) => {
  //             expect(res).to.have.status(404);
  //             expect(res.body.success).to.be.equal(false);
  //             expect(res.body.message).to.be.equal('Drop not found against provided Drop Id!');
  //             done();
  //         });
  //     });
  //     it('should update Drop.status to draft', async() => {
  //         const filter = {_id: dropId};
  //         const updation = {$set: {status: 'draft'}};
  //         const report = await DropModel.updateOne(filter, updation);

  //         expect(report.acknowledged).to.be.equal(true);
  //         expect(report.matchedCount).to.be.equal(1);
  //         expect(report.modifiedCount).to.be.equal(1);
  //     });
  //     it('should validate if drop is in editable state or not', (done) => {
  //         requestBody = {
  //             dropId: dropId,
  //             txHash: '0x2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f'
  //         }

  //         chai.request(server)
  //         .put('/v1-sso/drop/txHash')
  //         .auth(JWT, {type: 'bearer'})
  //         .send(requestBody)
  //         .end((err, res) => {
  //             expect(res).to.have.status(400);
  //             expect(res.body.success).to.be.equal(false);
  //             expect(res.body.message).to.be.equal
  //             ('Unable to update txHash, Drop is not in appropriate state!');
  //             done();
  //         });
  //     });
  //     it('should restore Drop.status to pending', async() => {
  //         const filter = {_id: dropId};
  //         const updation = {$set: {status: 'pending'}};
  //         const report = await DropModel.updateOne(filter, updation);

  //         expect(report.acknowledged).to.be.equal(true);
  //         expect(report.matchedCount).to.be.equal(1);
  //         expect(report.modifiedCount).to.be.equal(1);
  //     });
  //     it('should update txHash for the drop', (done) => {
  //         requestBody = {
  //             dropId: dropId,
  //             txHash: '0x2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f'
  //         }

  //         chai.request(server)
  //         .put('/v1-sso/drop/txHash')
  //         .auth(JWT, {type: 'bearer'})
  //         .send(requestBody)
  //         .end((err, res) => {
  //             console.log(res.body);
  //             expect(res).to.have.status(200);
  //             expect(res.body.success).to.be.equal(true);
  //             expect(res.body.message).to.be.equal
  //             ('Drop successfully updated, txHash added!');
  //             done();
  //         });
  //     });
  // });

  describe("Testing route: /drop/saleType/:saleType/:start/:end [GET]", () => {
    it("should validate the saleType passed in request param", (done) => {
      chai
        .request(server)
        .get("/v1-sso/drop/saleType/:fake/:0/:2")
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            " Requested param is not present in Drop schema!"
          );
          done();
        });
    });
    it("should validate DB query which fetches no data", (done) => {
      chai
        .request(server)
        .get("/v1-sso/drop/saleType/fixed-price/0/2")
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "No drops were found against provided saleType!"
          );
          done();
        });
    });
    it("should fetch drop data with draft status", (done) => {
      chai
        .request(server)
        .get("/v1-sso/drop/saleType/auction/0/4")
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("data");
          expect(res.body.success).to.be.equal(true);
          expect(res.body.data.length).to.be.equal(2);
          done();
        });
    });
  });
  describe("Testing route: /drop//nft/:nftId [DELETE]", () => {
    it("should validate the NFT query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();

      chai
        .request(server)
        .delete("/v1-sso/drop/nft/" + fakeId)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "No NFT found against provided nftId"
          );
          done();
        });
    });
    it("should do validation for dropless NFT", (done) => {
      chai
        .request(server)
        .delete("/v1-sso/drop/nft/" + droplessNFT)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal("Nft is not a part of any drop");
          done();
        });
    });
    it("should change the drop status to active", async () => {
      const filter = { _id: dropId };
      const updation = { $set: { status: "active" } };
      const report = await DropModel.updateOne(filter, updation);
      expect(report.acknowledged).to.be.equal(true);
      expect(report.matchedCount).to.be.equal(1);
      expect(report.modifiedCount).to.be.equal(1);
    });
    it("should validate the state of drop", (done) => {
      chai
        .request(server)
        .delete("/v1-sso/drop/nft/" + nftId)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "Cannot delete Drop because it is not in the draft state "
          );
          done();
        });
    });
    it("should restore drop status to draft", async () => {
      const filter = { _id: dropId };
      const updation = { $set: { status: "draft" } };
      const report = await DropModel.updateOne(filter, updation);
      expect(report.acknowledged).to.be.equal(true);
      expect(report.matchedCount).to.be.equal(1);
      expect(report.modifiedCount).to.be.equal(1);
    });
    it("should delete the NFT from drop", (done) => {
      chai
        .request(server)
        .delete("/v1-sso/drop/nft/" + nftId)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.equal(true);
          expect(res.body.message).to.be.equal(
            "NFT in drop deleted successfully"
          );
          done();
        });
    });
  });
  describe("Testing route: /drop/:dropId [DELETE]", () => {
    it("should validate the drop query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();

      chai
        .request(server)
        .delete("/v1-sso/drop/" + fakeId)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "Drop not found against drop Id"
          );
          done();
        });
    });
    it("should delete drop ", (done) => {
      chai
        .request(server)
        .delete("/v1-sso/drop/" + dropId)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          console.log({ res });
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.equal(true);
          expect(res.body.message).to.be.equal("Drop deleted successfully");
          done();
        });
    });
  });
  describe("Testing route: /drop/myDrops/:status/:start/:end [GET]", () => {
    it("should validate the status by which drop data is requested", (done) => {
      chai
        .request(server)
        .get(`/v1-sso/drop/myDrops/${"fake"}/${0}/${2}`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "Requested status is not present in drop schema"
          );
          done();
        });
    });
    it("should get drops of the user that is logged in", (done) => {
      const fakeId = mongoose.Types.ObjectId();

      chai
        .request(server)
        .get(`/v1-sso/drop/myDrops/${"draft"}/${0}/${2}`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.equal(true);
          expect(res.body).to.have.property("dropCount");
          expect(res.body.dropCount).to.be.equal(1);
          expect(res.body).to.have.property("data");
          done();
        });
    });
  });

  describe("Testing route: /drop/feature [PATCH]", () => {
    it("should validate complete request body parameters are passed", (done) => {
      chai
        .request(server)
        .patch("/v1-sso/drop/feature")
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "Drop Id not found in request body."
          );
          done();
        });
    });
    it("should validate request body parameters are not sent empty passed", (done) => {
      requestBody = {
        dropId: "",
      };

      chai
        .request(server)
        .patch("/v1-sso/drop/feature")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "Drop Id was empty in request body."
          );
          done();
        });
    });
    it("should validate the drop query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();
      requestBody = {
        dropId: fakeId,
      };

      chai
        .request(server)
        .patch("/v1-sso/drop/feature")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "Drop not found against drop Id."
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
        dropType: "721",
      };

      chai
        .request(server)
        .post("/v1-sso/drop/")
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

    it("should validate the owner of the drop", (done) => {
      requestBody = {
        dropId,
      };

      chai
        .request(server)
        .patch("/v1-sso/drop/feature")
        .auth(tempJWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          console.log(res);
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "You are not the owner of the drop."
          );
          done();
        });
    });
    //POSITIVE CASE
    it("should feature the drop", (done) => {
      requestBody = {
        dropId,
      };

      chai
        .request(server)
        .patch("/v1-sso/drop/feature")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          console.log(res);
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.equal(true);
          expect(res.body.message).to.be.equal("Drop Featured successfully.");
          done();
        });
    });
    //NEGATIVE CASE
    it("should Try to feature the same drop again", (done) => {
      requestBody = {
        dropId,
      };

      chai
        .request(server)
        .patch("/v1-sso/drop/feature")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          console.log(res);
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal("Drop already featured.");
          done();
        });
    });
  });

  describe("Testing route: /drop/feature [GET]", () => {
    it("should get featured drop of the user", (done) => {
      chai
        .request(server)
        .get("/v1-sso/drop/feature")
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          // console.log(res)
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.equal(true);
          expect(res.body).to.have.property("FeaturedDrop");
          expect(res.body.FeaturedDrop.isFeatured).to.be.equal(true);
          done();
        });
    });
  });
});
