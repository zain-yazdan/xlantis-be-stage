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
const NFTModel = require("../../models/v2-wallet-login/NFTModel");

if (process.env.NODE_MODE != "testing") {
  throw 'To run the tests, NODE_MODE should be set to "testing" in environment variables';
}

let JWT, requestBody, collectionId, existingFiles, NFTs;
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

describe("Test the NFT router by performing all operations on NFTs", () => {
  describe("Create a new user and login that user, it should then create a collection for that user", () => {
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

  describe("\nTesting route: /lazy-mint/NFT (POST)\n", () => {
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
        nftFormat: "png",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/lazy-mint/NFT")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "title was not found in request body"
          );
          done();
        });
    });

    it("should validate required attributes are not passed empty in request body", (done) => {
      requestBody = {
        title: "",
        description: "This is my special NFT, its very awesome.",
        collectionId: "63186494efc487d0d97b17b6",
        nftURI:
          "https://ipfs.io/ipfs/QmS8FdrxYsQ7fTDg4fmiFbTfLixb6rjACdSgxSptVDRCRs",
        previewImageURI:
          "https://ipfs.io/ipfs/QmS8FdrxYsQ7fTDg4fmiFbTfLixb6rjACdSgxSptVDRCRd",
        metadataURI:
          "https://ipfs.io/ipfs/QmS8FdrxYsQ7fTDg4fmiFbTfLixb6rjACdSgxSptVDRCRq",
        nftFormat: "png",
        type: "Epic",
        properties: {
          Artist: "Van Gough",
          Location: "France",
        },
      };

      chai
        .request(server)
        .post("/v2-wallet-login/lazy-mint/NFT")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("title was empty in request body");
          done();
        });
    });

    it("should validate the collection query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();
      requestBody = {
        title: "My NFT",
        description: "This is my special NFT, its very awesome.",
        collectionId: fakeId,
        nftURI:
          "https://ipfs.io/ipfs/QmS8FdrxYsQ7fTDg4fmiFbTfLixb6rjACdSgxSptVDRCRs",
        previewImageURI:
          "https://ipfs.io/ipfs/QmS8FdrxYsQ7fTDg4fmiFbTfLixb6rjACdSgxSptVDRCRd",
        metadataURI:
          "https://ipfs.io/ipfs/QmS8FdrxYsQ7fTDg4fmiFbTfLixb6rjACdSgxSptVDRCRq",
        nftFormat: "png",
        type: "Epic",
        properties: {
          Artist: "Van Gough",
          Location: "France",
        },
      };

      chai
        .request(server)
        .post("/v2-wallet-login/lazy-mint/NFT")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "Collection not found against provided Collection Id"
          );
          done();
        });
    });

    // POSTIVE CASE
    it("should add a simple image NFT to a collection", (done) => {
      requestBody = {
        title: "My NFT",
        description: "This is my special NFT, its very awesome.",
        collectionId: collectionId,
        nftURI:
          "https://ipfs.io/ipfs/QmS8FdrxYsQ7fTDg4fmiFbTfLixb6rjACdSgxSptVDRCRs",
        previewImageURI:
          "https://ipfs.io/ipfs/QmS8FdrxYsQ7fTDg4fmiFbTfLixb6rjACdSgxSptVDRCRd",
        metadataURI:
          "https://ipfs.io/ipfs/QmS8FdrxYsQ7fTDg4fmiFbTfLixb6rjACdSgxSptVDRCRq",
        nftFormat: "png",
        type: "Epic",
        properties: {
          Artist: "Van Gough",
          Location: "France",
        },
      };

      chai
        .request(server)
        .post("/v2-wallet-login/lazy-mint/NFT")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("nftId");
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq("NFT added successfully");
          done();
        });
    });

    it("should add multimedia NFT to a collection", (done) => {
      requestBody = {
        title: "My NFT 2",
        description: "This is my special NFT, its very awesome.",
        collectionId: collectionId,
        nftURI:
          "https://ipfs.io/ipfs/QmS8FdrxYsQ7fTDg4fmiFbTfLixb6rjACdSgSptVDRCRs",
        previewImageURI:
          "https://ipfs.io/ipfs/QmS8FdrxYsQ7fTDg4fmiFbTfLixbrjACdSgxSptVDRCRd",
        metadataURI:
          "https://ipfs.io/ipfs/QmS8FdrxYsQ7fTDg4fmiFbTfLixb6rACdSgxSptVDRCRq",
        nftFormat: "gltf",
        type: "Epic",
        properties: {
          Artist: "Van Gough",
          Location: "France",
        },
      };

      chai
        .request(server)
        .post("/v2-wallet-login/lazy-mint/NFT")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          console.log("res : ", res);
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("nftId");
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq("NFT added successfully");
          done();
        });
    });
  });

  describe("\nTesting route: /lazy-mint/voucher (PATCH)\n", () => {
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
        signature:
          "0x3bc843a917d6c19c487c1d0c660cdd61389ce2a7651ee3171bcc212ffddca164193f1f2e06f7ed8f9fbf2254232d99848a8102b552032b68a5507b4d81492f0f1b",
      };

      chai
        .request(server)
        .patch("/v2-wallet-login/lazy-mint/voucher")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "nftId was not found in request body"
          );
          done();
        });
    });

    it("should validate required attributes are not passed empty in request body", (done) => {
      requestBody = {
        nftId: "",
        signature:
          "0x3bc843a917d6c19c487c1d0c660cdd61389ce2a7651ee3171bcc212ffddca164193f1f2e06f7ed8f9fbf2254232d99848a8102b552032b68a5507b4d81492f0f1b",
      };

      chai
        .request(server)
        .patch("/v2-wallet-login/lazy-mint/voucher")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("nftId was empty in request body");
          done();
        });
    });

    it("should retrive NFT(s) from DB ", async () => {
      NFTs = await NFTModel.find({});
      expect(NFTs.length).to.be.equal(2);
    });

    it("should validate signature sent in request body", (done) => {
      const fakeId = mongoose.Types.ObjectId();
      requestBody = {
        nftId: NFTs[0],
        signature:
          "3bc843a917d6c19c487c1d0c660cdd61389ce2a7651ee3171bcc212ffddca164193f1f2e06f7ed8f9fbf2254232d99848a8102b552032b68a5507b4d81492f0f1b",
      };

      chai
        .request(server)
        .patch("/v2-wallet-login/lazy-mint/voucher")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "Invalid signature sent, it must be a strict hex number"
          );
          done();
        });
    });

    it("should validate the lazyMintId query from DB ", (done) => {
      const fakeId = mongoose.Types.ObjectId();
      requestBody = {
        nftId: fakeId,
        signature:
          "0x3bc843a917d6c19c487c1d0c660cdd61389ce2a7651ee3171bcc212ffddca164193f1f2e06f7ed8f9fbf2254232d99848a8102b552032b68a5507b4d81492f0f1b",
      };

      chai
        .request(server)
        .patch("/v2-wallet-login/lazy-mint/voucher")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "lazy minted NFT not found against provided id"
          );
          done();
        });
    });
    it("should add voucher signature", (done) => {
      requestBody = {
        nftId: NFTs[0],
        signature:
          "0x3bc843a917d6c19c487c1d0c660cdd61389ce2a7651ee3171bcc212ffddca164193f1f2e06f7ed8f9fbf2254232d99848a8102b552032b68a5507b4d81492f0f1b",
      };

      chai
        .request(server)
        .patch("/v2-wallet-login/lazy-mint/voucher")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq(
            "voucher signature added successfully"
          );
          done();
        });
    });
  });
});
