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

const CollectionModel = require("../models/CollectionModel");
const UserModel = require("../models/UserModel");

if (process.env.NODE_MODE != "testing") {
  throw 'To run the tests, NODE_MODE should be set to "testing" in environment variables';
}

let requestBody, collectionId, existingFiles, superAdminJWT, tempJWT;
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

describe("Test the collection router by performing all operations on collections", () => {
  describe("Create new admin user", () => {
    it("should login user as super admin", (done) => {
      requestBody = {
        walletAddress: process.env.SUPER_ADMIN_WALLET_ADDRESS,
      };

      chai
        .request(server)
        .post("/user/auth/super-admin-login")
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body).to.have.property("raindropToken");
          expect(res.body.message).to.be.eq("Super Admin signup successfully.");
          superAdminJWT = res.body.raindropToken;
          done();
        });
    });

    it("should add admin by super admin", (done) => {
      requestBody = {
        walletAddress: "0xB60E0c6fb16761687e19b8A77C7A5Ca7E64c4258",
      };

      chai
        .request(server)
        .post("/super-admin/addAdmin")
        .auth(superAdminJWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq("Admin added successfully...");
          done();
        });
    });

    it("should login admin", (done) => {
      requestBody = {
        walletAddress: "0xB60E0c6fb16761687e19b8A77C7A5Ca7E64c4258",
      };

      chai
        .request(server)
        .post("/user/auth/admin-login")
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body).to.have.property("raindropToken");
          expect(res.body.message).to.be.eq(
            "Admin successfully logged in, profile information required to access website features..."
          );
          tempJWT = res.body.raindropToken;
          done();
        });
    });

    it("should get the admin Id in the database", async () => {
      const admin = await UserModel.findOne({
        walletAddress: "0xB60E0c6fb16761687e19b8A77C7A5Ca7E64c4258",
      });
      console.log("admin : ", admin);
      expect(admin).to.have.property("_id");
      expect(admin).to.have.property("walletAddress");
      expect(admin.role).to.be.eq("admin");
      adminId = admin._id;
    });

    it("should verify the admin.", (done) => {
      requestBody = { adminId };

      chai
        .request(server)
        .patch("/super-admin/admin/verify")
        .auth(superAdminJWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq("Admin verified.");
          done();
        });
    });
  });

  describe(`\nTesting route: '/collection/' (POST)\n`, () => {
    it("should validate missing request body parameter", (done) => {
      requestBody = {
        name: "Armada",
        description:
          "This is test collection for an armada owner by the great Captain Jack Sparrow, Savy!?",
      };

      chai
        .request(server)
        .post("/collection/")
        .auth(tempJWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .field("name", requestBody.name)
        .field("description", requestBody.description)
        .attach("thumbnail", "test/stub1.txt")
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.contain("not found in request body!");
          done();
        });
    });

    it("should validate empty request body parameter", (done) => {
      requestBody = {
        name: "Armada",
        symbol: "",
        description:
          "This is test collection for an armada owner by the great Captain Jack Sparrow, Savy!?",
      };

      chai
        .request(server)
        .post("/collection/")
        .auth(tempJWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .field("name", requestBody.name)
        .field("symbol", requestBody.symbol)
        .field("description", requestBody.description)
        .attach("thumbnail", "test/stub1.txt")
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.contain("was empty in request body!");
          done();
        });
    });

    it("should validate that a thumbail file is passed as request files parameter", (done) => {
      requestBody = {
        name: "Armada",
        symbol: "JS",
        description:
          "This is test collection for an armada owner by the great Captain Jack Sparrow, Savy!?",
      };

      chai
        .request(server)
        .post("/collection/")
        .auth(tempJWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .field("name", requestBody.name)
        .field("symbol", requestBody.symbol)
        .field("description", requestBody.description)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.contain("is missing in request files!");
          done();
        });
    });

    it("should validate royalty fees is a percentage", (done) => {
      requestBody = {
        name: "Armada",
        symbol: "JS",
        description:
          "This is test collection for an armada owner by the great Captain Jack Sparrow, Savy!?",
        royaltyFee: "101",
      };

      chai
        .request(server)
        .post("/collection/")
        .auth(tempJWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .field("name", requestBody.name)
        .field("symbol", requestBody.symbol)
        .field("description", requestBody.description)
        .field("royaltyFee", requestBody.royaltyFee)
        .attach("thumbnail", "test/stub1.txt")
        .end((err, res) => {
          console.log("res: ", res.body);
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "Inappropriate royalty fees value set. It must be a percentage."
          );
          done();
        });
    });

    // Positive case
    it("should create a new collection", (done) => {
      requestBody = {
        name: "Armada",
        symbol: "JS",
        description:
          "This is test collection for an armada owner by the great Captain Jack Sparrow, Savy!?",
      };

      chai
        .request(server)
        .post("/collection/")
        .auth(tempJWT, { type: "bearer" })
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

  describe(`\nTesting route: /collection/:collectionId (PUT). It should update collection thumbnail and/or its description.\n`, () => {
    // path variable validation test case skipped - they should be removed from code
    // user test case skipped for now - its useless in my opinion

    it("should valide the collection query from DB ", (done) => {
      const randomObjectID = mongoose.Types.ObjectId();

      chai
        .request(server)
        .put("/collection/" + randomObjectID)
        .auth(tempJWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .attach("thumbnail", "test/stub2.txt")
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("This collection does not exists");
          done();
        });
    });

    // Positive Case 01
    it("should update a collections thumbnail when description is not provided", (done) => {
      chai
        .request(server)
        .put("/collection/" + collectionId)
        .auth(tempJWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .attach("thumbnail", "test/stub2.txt")
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("updates");
          expect(res.body.updates).to.be.eq(1);
          expect(res.body.message).to.be.eq("Collection Updated successfully!");
          done();
        });
    });

    // Positive Case 02
    it("should update a collections thumbnail when description is provided", (done) => {
      requestBody = {
        description:
          "The Black Pearl got lost, so I Captain Jack Sparrow am changing the description of my armada, Savy!?",
      };

      chai
        .request(server)
        .put("/collection/" + collectionId)
        .auth(tempJWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .field("description", requestBody.description)
        .attach("thumbnail", "test/stub1.txt")
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("updates");
          expect(res.body.updates).to.be.eq(1);
          expect(res.body.message).to.be.eq("Collection Updated successfully!");
          done();
        });
    });
  });

  describe(`\nTesting route: '/collection/txHash/:collectionId' (PUT)\n`, () => {
    // path variable validation test case skipped - they should be removed from code

    it("should validate txHash is passed as a request body parameter", (done) => {
      chai
        .request(server)
        .put("/collection/txHash/" + collectionId)
        .auth(tempJWT, { type: "bearer" })
        // .send()
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "txHash not found in request body!"
          );
          done();
        });
    });

    it("should validate txHash is not an empty string", (done) => {
      requestBody = {
        txHash: "",
      };

      chai
        .request(server)
        .put("/collection/txHash/" + collectionId)
        .auth(tempJWT, { type: "bearer" })
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

    it("should valide the collection query from DB ", (done) => {
      const randomObjectId = mongoose.Types.ObjectId();

      requestBody = {
        txHash:
          "0xf3dc2623e152fb5a7d8d4ef4e52caf8245bad1fdd54981ea2def21b840978d9a",
      };

      chai
        .request(server)
        .put("/collection/txHash/" + randomObjectId)
        .auth(tempJWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("This collection does not exists");
          done();
        });
    });

    // Positive case
    it("should update a collections description and thumbnail", (done) => {
      requestBody = {
        txHash:
          "0xf3dc2623e152fb5a7d8d4ef4e52caf8245bad1fdd54981ea2def21b840978d9a",
      };

      chai
        .request(server)
        .put("/collection/txHash/" + collectionId)
        .auth(tempJWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.updates).to.be.eq(1);
          expect(res.body.message).to.be.eq("Collection Updated successfully!");
          done();
        });
    });
  });

  describe(`\nTesting route: '/collection/approve' (PUT)\n`, () => {
    it("should validate required request body paramaters are passed", (done) => {
      requestBody = {
        collectionId: collectionId,
      };

      chai
        .request(server)
        .put("/collection/approve")
        .auth(tempJWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "factoryType not found in request body!"
          );
          done();
        });
    });

    it("should validate required request body paramaters are not empty", (done) => {
      requestBody = {
        collectionId: collectionId,
        factoryType: "",
      };

      chai
        .request(server)
        .put("/collection/approve")
        .auth(tempJWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "factoryType was empty in request body!"
          );
          done();
        });
    });

    it("should factoryType request body paramater", (done) => {
      requestBody = {
        collectionId: collectionId,
        factoryType: "dummy-factory",
      };

      chai
        .request(server)
        .put("/collection/approve")
        .auth(tempJWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "Invalid factoryType sent, request factoryType does not exist!"
          );
          done();
        });
    });

    it("should validate the collection query from DB ", (done) => {
      const randomObjectId = mongoose.Types.ObjectId();
      requestBody = {
        collectionId: randomObjectId,
        factoryType: "auction",
      };

      chai
        .request(server)
        .put("/collection/approve")
        .auth(tempJWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("This collection does not exists");
          done();
        });
    });

    // POSITIVE CASE
    it("should approve the collection", (done) => {
      requestBody = {
        collectionId: collectionId,
        factoryType: "auction",
      };

      chai
        .request(server)
        .put("/collection/approve")
        .auth(tempJWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq(
            "Collection verified successfully!"
          );
          done();
        });
    });

    it("should reject approval as collection is already approved ", (done) => {
      requestBody = {
        collectionId: collectionId,
        factoryType: "auction",
      };

      chai
        .request(server)
        .put("/collection/approve")
        .auth(tempJWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "This collection has already been approved by auction factory"
          );
          done();
        });
    });
  });

  describe("\nTesting route: /collection/myCollections/:start/:end (GET).\n", () => {
    it("should return collections owned by the user logged in at the time", (done) => {
      chai
        .request(server)
        .get(`/collection/myCollections/ ${0} / ${1}`)
        .auth(tempJWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("collectionData");
          expect(res.body).to.have.property("collectionCount");
          expect(res.body.collectionCount).to.be.eq(1);
          done();
        });
    });
  });

  describe("\nTesting route: /collection/collections (GET).\n", () => {
    it("should validate collectionType path parameter", (done) => {
      chai
        .request(server)
        .get(`/collection/collections/111`)
        .auth(tempJWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "Requested contractType is not present in collection schema"
          );
          done();
        });
    });

    it("should mimic the behavior of CloneCreated event for collection factory", async () => {
      const report = await CollectionModel.updateOne(
        { _id: collectionId },
        {
          cloneId: 1,
          nftContractAddress: "0xBB9bc244D798123fDe783fCc1C72d3Bb8C189413",
          contractType: "721",
          isDeployed: true,
        }
      );

      expect(report.acknowledged).to.be.equal(true);
      expect(report.matchedCount).to.be.equal(1);
      expect(report.modifiedCount).to.be.equal(1);
    });

    it("should return the collections owned by the user logged in for specified contractType", (done) => {
      chai
        .request(server)
        .get(`/collection/collections/721`)
        .auth(tempJWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("collectionData");
          expect(res.body.collectionData.length).to.be.eq(1);
          done();
        });
    });
  });

  describe("\nTesting route: /collection/:collectionId (GET).\n", () => {
    it("should create a couple NFTs in the current collection", (done) => {
      const requestBody = {
        collectionId: collectionId,
        data: [
          {
            title: "Black Pearl",
            nftURI: "https://scytalelabs.mypinata.cloud/ipfs/pearl.png",
            metadataURI: "https://scytalelabs.mypinata.cloud/ipfs/pearl.json",
            nftFormat: "png",
          },
          {
            title: "The Walrus",
            nftURI: "https://scytalelabs.mypinata.cloud/ipfs/walrus.png",
            metadataURI: "https://scytalelabs.mypinata.cloud/ipfs/walrus.json",
            nftFormat: "png",
          },
        ],
      };
      chai
        .request(server)
        .post("/nft/addNFTs")
        .auth(tempJWT, { type: "bearer" })
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

    it(`should return collection data and data of its associated NFT data`, (done) => {
      chai
        .request(server)
        .get(`/collection/${collectionId}`)
        .auth(tempJWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("collectionData");
          expect(res.body).to.have.property("nftsdata");
          expect(res.body.nftsdata.length).to.be.eq(2);
          done();
        });
    });
  });
});
