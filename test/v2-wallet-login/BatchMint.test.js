const chai = require("chai");
const chaiHttp = require("chai-http");
const mocha = require("mocha");
const mongoose = require("mongoose");
const server = require("../../app");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const expect = chai.expect;
chai.use(chaiHttp);

// const VerifyEmail = require("../models/VerifyEmailModel");
const BatchMint = require("../../models/v2-wallet-login/BatchModel");

if (process.env.NODE_MODE != "testing") {
  throw 'To run the tests, NODE_MODE should be set to "testing" in environment variables';
}

let JWT, requestBody, collectionId, existingFiles, nftId, batchId;
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

describe("Test batchMint router by performing all operations for batch-minting", () => {
  describe("\nCreate a new user and login that user, it should then create a collection for that user", () => {
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
        walletAddress: "0xE66a70d89D44754f726A4B463975d1F624530111",
        signature:
          "0x74cc1a80d9b3353b97c2c3aed6f3d936766739faf949e161f3af864cb48dbfbe284b5ad7c3064efa2b02ac35dd04103ffb73d962b5cd251d9e91c54cb4eb4ab11b",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/user/auth/login")
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          // expect(res.body).to.have.property('userId');
          expect(res.body).to.have.property("token");
          // expect(res.body).to.have.property('roles');
          // expect(res.body.isNewUser).to.be.eq(true);
          expect(res.body.message).to.be.eq("User created and logged in");
          JWT = res.body.token;
          done();
        });
    });

    it("should create a new collection", (done) => {
      requestBody = {
        name: "Armada",
        symbol: "JS",
        description:
          "This is test collection for an armada owner by the great Captain Jack Sparrow, Savy!?",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/collection/")
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
  });
  describe("\nTesting route: /batch-mint/ (POST)", () => {
    it("should validate required attributes are passed as request body parameters", (done) => {
      requestBody = {
        collectionId: collectionId,
        nftFormat: "png",
        nftURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pearl.png",
        metadataURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pearl.json",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/batch-mint/")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("title not found in request body!");
          done();
        });
    });

    it("should validate required attributes are not passed empty in request body", (done) => {
      requestBody = {
        title: "",
        collectionId: collectionId,
        nftFormat: "png",
        nftURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pearl.png",
        metadataURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pearl.json",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/batch-mint/")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("title was empty in request body!");
          done();
        });
    });

    it("should validate the collection query from DB ", (done) => {
      const randomObjectID = mongoose.Types.ObjectId();

      requestBody = {
        title: "Black Pearl",
        collectionId: randomObjectID,
        nftFormat: "png",
        nftURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pearl.png",
        metadataURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pearl.json",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/batch-mint/")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "Collection not found against provided Collection Id!"
          );
          done();
        });
    });

    //POSITIVE CASE: 1
    it("should create a new batch and add an NFT(PNG) to it", (done) => {
      requestBody = {
        title: "Black Pearl",
        collectionId: collectionId,
        nftFormat: "png",
        nftURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pearl.png",
        metadataURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pearl.json",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/batch-mint/")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("batchId");
          expect(res.body).to.have.property("nftId");
          expect(res.body.message).to.be.eq("Batch created successfully!");
          batchId = res.body.batchId;
          nftId = res.body.nftId;
          done();
        });
    });

    //POSITIVE CASE: 2
    it("should create a new batch and add an NFT(GLTF) to it", (done) => {
      requestBody = {
        title: "Black Pearl",
        collectionId: collectionId,
        nftFormat: "gltf",
        nftURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPYa/pearl.gltf",
        previewImageURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPYa/pearl.png",
        metadataURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPYa/pearl.json",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/batch-mint/")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("batchId");
          expect(res.body).to.have.property("nftId");
          expect(res.body.message).to.be.eq("Batch created successfully!");
          done();
        });
    });
  });

  describe("\nTesting route: /batch-mint/nft (POST)", () => {
    it("should validate required attributes are passed as request body parameters", (done) => {
      requestBody = {
        collectionId: collectionId,
        batchId: batchId,
        nftFormat: "png",
        nftURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dutchman.png",
        metadataURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dutchman.json",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/batch-mint/nft")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("title not found in request body!");
          done();
        });
    });

    it("should validate required attributes are not passed empty in request body", (done) => {
      requestBody = {
        title: "",
        collectionId: collectionId,
        batchId: batchId,
        nftFormat: "png",
        nftURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dutchman.png",
        metadataURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dutchman.json",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/batch-mint/nft")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("title was empty in request body!");
          done();
        });
    });

    it("should validate the collection query from DB ", (done) => {
      const randomObjectID = mongoose.Types.ObjectId();

      requestBody = {
        title: "The Dutchman",
        collectionId: randomObjectID,
        batchId: batchId,
        nftFormat: "png",
        nftURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dutchman.png",
        metadataURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dutchman.json",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/batch-mint/nft")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "Collection not found against provided Collection Id!"
          );
          done();
        });
    });

    it("should validate the batch query from DB ", (done) => {
      const randomObjectID = mongoose.Types.ObjectId();

      requestBody = {
        title: "The Dutchman",
        collectionId: collectionId,
        batchId: randomObjectID,
        nftFormat: "png",
        nftURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dutchman.png",
        metadataURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dutchman.json",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/batch-mint/nft")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "Batch not found against provided batchId!"
          );
          done();
        });
    });

    //POSITIVE CASE: 1
    it("should create a new batch and add an NFT(PNG) to it", (done) => {
      requestBody = {
        title: "The Dutchman 1",
        collectionId: collectionId,
        batchId: batchId,
        nftFormat: "png",
        nftURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dutchman.png",
        metadataURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dutchman.json",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/batch-mint/nft")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("nftId");
          expect(res.body.message).to.be.eq(
            "NFT created and added to collection and batch created successfully!"
          );
          done();
        });
    });

    //POSITIVE CASE: 2
    it("should create a new batch and add an NFT(GLTF) to it", (done) => {
      requestBody = {
        title: "The Dutchman 2",
        batchId: batchId,
        collectionId: collectionId,
        nftFormat: "gltf",
        nftURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZb/dutchman.gltf",
        previewImageURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dutchman.png",
        metadataURI:
          "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZb/dutchman.json",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/batch-mint/nft")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          console.log(res.body);
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("nftId");
          expect(res.body.message).to.be.eq(
            "NFT created and added to collection and batch created successfully!"
          );
          done();
        });
    });
  });

  describe("\nTesting route: /batch-mint/:batchId (GET)", () => {
    it("should validate the batch query from DB ", (done) => {
      const randomObjectID = mongoose.Types.ObjectId();
      chai
        .request(server)
        .get("/v2-wallet-login/batch-mint/" + randomObjectID)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "no batch found against provided batchId."
          );
          done();
        });
    });

    it("should get the request batchId if it exists", (done) => {
      chai
        .request(server)
        .get("/v2-wallet-login/batch-mint/" + batchId)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("batchData");
          done();
        });
    });
  });
  describe("\nTesting route: /batch-mint/tx-hash (PUT)", () => {
    it("should validate required attributes are passed as request body parameters", (done) => {
      requestBody = {
        batchId: batchId,
      };

      chai
        .request(server)
        .put("/v2-wallet-login/batch-mint/tx-hash")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "txHash not found in request body!"
          );
          done();
        });
    });
    it("should validate required attributes are not passed empty in request body ", (done) => {
      requestBody = {
        batchId: batchId,
        txHash: "",
      };

      chai
        .request(server)
        .put("/v2-wallet-login/batch-mint/tx-hash")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "txHash was empty in request body!"
          );
          done();
        });
    });

    it("should validate the batch query from DB ", (done) => {
      const randomObjectID = mongoose.Types.ObjectId();
      requestBody = {
        batchId: randomObjectID,
        txHash:
          "0x2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f",
      };

      chai
        .request(server)
        .put("/v2-wallet-login/batch-mint/tx-hash")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "No batch found against provided batchId."
          );
          done();
        });
    });

    it("should add txHash to the batch", (done) => {
      requestBody = {
        batchId: batchId,
        txHash:
          "0x2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f",
      };

      chai
        .request(server)
        .put("/v2-wallet-login/batch-mint/tx-hash")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.equal(true);
          expect(res.body.message).to.be.equal(
            "transaction hash sucessfully added"
          );
          done();
        });
    });
  });
  describe("\nTesting route: /batch-mint/minted/:batchId (PUT)", () => {
    it("should validate blockchainIds request body parameter", (done) => {
      chai
        .request(server)
        .put(`/v2-wallet-login/batch-mint/minted/${batchId}`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "blockchainIds parameter not found in request body!"
          );
          done();
        });
    });

    it("should validate the batch query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();
      requestBody = {
        blockchainIds: [1, 2],
      };

      chai
        .request(server)
        .put(`/v2-wallet-login/batch-mint/minted/${fakeId}`)
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "No batch found against provided batchId."
          );
          done();
        });
    });

    it("should validate the quanitity of blockchainIds passed", (done) => {
      requestBody = {
        blockchainIds: [1, 2],
      };

      chai
        .request(server)
        .put(`/v2-wallet-login/batch-mint/minted/${batchId}`)
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "blockchainIds sent in request body didnt match the amount of NFTs in the batch!"
          );
          done();
        });
    });

    it("should update nftIds as well as isMinted flag", (done) => {
      requestBody = {
        blockchainIds: [1, 2, 3],
      };

      chai
        .request(server)
        .put(`/v2-wallet-login/batch-mint/minted/${batchId}`)
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.equal(true);
          expect(res.body.message).to.be.equal("NFTs sucessfully updated");
          done();
        });
    });
  });
  describe("\nTesting route: /batch-mint/collection (PUT)", () => {
    it("should validate missing request body parameters", (done) => {
      chai
        .request(server)
        .put("/v2-wallet-login/batch-mint/collection")
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "batchId not found in request body!"
          );
          done();
        });
    });
    it("should validate empty request body parameters", (done) => {
      requestBody = {
        batchId: batchId,
        collectionId: "",
      };

      chai
        .request(server)
        .put("/v2-wallet-login/batch-mint/collection")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "collectionId was empty in request body!"
          );
          done();
        });
    });
    it("should validate the batch query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();
      requestBody = {
        batchId: fakeId,
        collectionId: collectionId,
      };

      chai
        .request(server)
        .put("/v2-wallet-login/batch-mint/collection")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "Provided batch Id does not any existing batch"
          );
          done();
        });
    });
    it("should validate the target collection query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();
      requestBody = {
        batchId: batchId,
        collectionId: fakeId,
      };

      chai
        .request(server)
        .put("/v2-wallet-login/batch-mint/collection")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "Collection to update not found"
          );
          done();
        });
    });
    it("should update batch with a fake collection id", async () => {
      const fakeId = mongoose.Types.ObjectId();
      const filter = { _id: batchId };
      const updation = { $set: { collectionId: fakeId } };

      const report = await BatchMint.updateOne(filter, updation);
      expect(report.acknowledged).to.be.equal(true);
      expect(report.matchedCount).to.be.equal(1);
      expect(report.modifiedCount).to.be.equal(1);
    });
    it("should validate the source collection query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();
      requestBody = {
        batchId: batchId,
        collectionId: collectionId,
      };

      chai
        .request(server)
        .put("/v2-wallet-login/batch-mint/collection")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.equal(false);
          expect(res.body.message).to.be.equal(
            "sourceCollection to update not found"
          );
          done();
        });
    });
    it("should restore the correct/original collection id", async () => {
      const filter = { _id: batchId };
      const updation = { $set: { collectionId: collectionId } };

      const report = await BatchMint.updateOne(filter, updation);
      expect(report.acknowledged).to.be.equal(true);
      expect(report.matchedCount).to.be.equal(1);
      expect(report.modifiedCount).to.be.equal(1);
    });

    let target_collection;
    it("should create a new temp collection", (done) => {
      requestBody = {
        name: "Temp",
        symbol: "Savy",
        description: "This is temp collection, Savy!?",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/collection/")
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
          target_collection = res.body.collection._id;
          done();
        });
    });
    // POSITIVE CASE
    it("should move collection NFTs from source to destination", (done) => {
      requestBody = {
        batchId: batchId,
        collectionId: target_collection,
      };

      chai
        .request(server)
        .put("/v2-wallet-login/batch-mint/collection")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.equal(true);
          expect(res.body.message).to.be.equal("Collection moved!");
          done();
        });
    });
  });
  describe("\nTesting route: /batch-mint/nft/:nftObjId (DELETE)", () => {
    it("should validate the NFT query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();

      chai
        .request(server)
        .delete("/v2-wallet-login/batch-mint/nft/" + fakeId)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "Provided NFT Id does not match any existing NFT"
          );
          done();
        });
    });
    it("should delete the NFT specified within the batch", (done) => {
      console.log({ nftId });
      chai
        .request(server)
        .delete("/v2-wallet-login/batch-mint/nft/" + nftId)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq(
            "NFT deleted successfully and associated documents updated!"
          );
          done();
        });
    });
  });
  describe("\nTesting route: /batch-mint/:batchId (DELETE)", () => {
    it("should validate the batch query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();

      chai
        .request(server)
        .delete("/v2-wallet-login/batch-mint/" + fakeId)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "no batch found against provided batchId."
          );
          done();
        });
    });
    it("should delete the entire specified batch", (done) => {
      console.log({ nftId });
      chai
        .request(server)
        .delete("/v2-wallet-login/batch-mint/" + batchId)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq("Requested batch removed");
          done();
        });
    });
  });
});
