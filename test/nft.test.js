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

const CollectionModel = require("../models/CollectionModel");

if (process.env.NODE_MODE != "test") {
  throw 'To run the tests, NODE_MODE should be set to "test" in environment variables';
}

let JWT, requestBody, collectionId, existingFiles, nftId;
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
    it("should add domain for the newly created admin", (done) => {
      requestBody = {
        domain: "nike.com",
        companyName: "Nike",
        designation: "CEO",
        industryType: "Sports & Fashion",
        reasonForInterest: "Nothing",
      };

      chai
        .request(server)
        .put("/v2-wallet-login/user/admin/add-info")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          console.log(res);
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq(
            "Admin information added successfully"
          );
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
  });

  describe("\nTesting route: /nft/addNFTs (POST)\n", () => {
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
        collectionId,
        data: [
          {
            title: "Black Pearl",
            nftURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pearl.png",
            metadataURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pearl.json",
          },
        ],
      };

      chai
        .request(server)
        .post("/nft/addNFTs")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "nftFormat not found in request body of NFT number: 1!"
          );
          done();
        });
    });

    it("should validate required attributes are not passed empty in request body", (done) => {
      requestBody = {
        collectionId,
        data: [
          {
            title: "",
            nftFormat: "png",
            nftURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pearl.png",
            metadataURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pearl.json",
            totalSupply: 5
          },
        ],
      };

      chai
        .request(server)
        .post("/nft/addNFTs")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "title was empty in request body of NFT number: 1!"
          );
          done();
        });
    });

    it("should validate the collection query from DB ", (done) => {
      const randomObjectID = mongoose.Types.ObjectId();
      console.log("random: ", randomObjectID);
      requestBody = {
        collectionId: randomObjectID,
        data: [
          {
            title: "Black Pearl",
            nftFormat: "png",
            nftURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pearl.png",
            metadataURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pearl.json",
            totalSupply: 5
            },
        ],
      };

      chai
        .request(server)
        .post("/nft/addNFTs")
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
    it("should add 2 new NFTs to a collection", (done) => {
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
            totalSupply: 5
          },
          {
            title: "The Dutchman",
            type: "Rare",
            nftFormat: "mp3",
            nftURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dutchman.mp3",
            metadataURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dutchman.json",
            previewImageURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/image.jpg",
            totalSupply: 5
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
  });
  describe("\nTesting route: /nft/:nftId (PUT)\n", () => {
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

    it("should fetch collection from DB and save NFT Id(s)", async () => {
      const collection = await CollectionModel.findById(collectionId);
      nftId = collection.nftId[0];
      expect(collection).to.have.property("_id");
      expect(collection).to.have.property("nftId");
      expect(nftId).to.be.eq(collection.nftId[0]);
    });

    it("should validate for empty request body parameters", (done) => {
      requestBody = { title: "" };

      chai
        .request(server)
        .put("/nft/" + nftId)
        .send(requestBody)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("title not found in request body!");
          done();
        });
    });

    it("should validate the NFT query from DB ", (done) => {
      const randomObjectID = mongoose.Types.ObjectId();
      requestBody = { type: "Legendary" };

      chai
        .request(server)
        .put("/nft/" + randomObjectID)
        .send(requestBody)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "NFT not found against provided id"
          );
          done();
        });
    });

    // POSTIVE CASE
    it(`should update nft with id ${nftId}`, (done) => {
      requestBody = { type: "Legendary" };

      chai
        .request(server)
        .put("/nft/" + nftId)
        .send(requestBody)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq("NFT updated sucessfully!");
          done();
        });
    });
  });

  describe("\nTesting route: /nft/minted (PUT)\n", () => {
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

    it("should validate for missing request body parameters", (done) => {
      requestBody = {
        nftId: 1,
        nftObjectId: nftId,
      };

      chai
        .request(server)
        .put("/nft/minted")
        .send(requestBody)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "txHash not found in request body!"
          );
          done();
        });
    });

    it("should validate for empty request body parameters", (done) => {
      requestBody = {
        txHash: "",
        nftId: 1,
        nftObjectId: nftId,
      };

      chai
        .request(server)
        .put("/nft/minted")
        .send(requestBody)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "txHash was empty in request body!"
          );
          done();
        });
    });

    it("should validate for correctness of txHash ", (done) => {
      requestBody = {
        txHash:
          "2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f",
        nftId: 1,
        nftObjectId: nftId,
      };

      chai
        .request(server)
        .put("/nft/minted")
        .send(requestBody)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "Invalid txHash sent in request body!"
          );
          done();
        });
    });

    it("should validate the NFT query from DB ", (done) => {
      const randomObjectID = mongoose.Types.ObjectId();
      requestBody = {
        txHash:
          "0x2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f",
        nftId: 1,
        nftObjectId: randomObjectID,
      };

      chai
        .request(server)
        .put("/nft/minted")
        .send(requestBody)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "NFT not found against provided id"
          );
          done();
        });
    });

    // POSTIVE CASE
    it(`should update nft with id ${nftId}`, (done) => {
      requestBody = {
        txHash:
          "0x2592cf699903e83bfd664aa4e339388fd044fe31643a85037be803a5d162729f",
        nftId: 1,
        nftObjectId: nftId,
      };

      chai
        .request(server)
        .put("/nft/minted")
        .send(requestBody)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq("NFT updated sucessfully!");
          done();
        });
    });
  });

  describe("\nTesting route: /nft/:collectionId (GET)\n", () => {
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

    it("should get title, nftId, _id and nftURI for NFTs in a collection", (done) => {
      chai
        .request(server)
        .get("/nft/" + collectionId)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body).to.have.property("data");
          expect(res.body.data.length).to.be.eq(2);
          done();
        });
    });
  });

  describe("\nTesting route: /nft/:nftId/:collectionId (GET)\n", () => {
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

    it("should validate the NFT query from DB ", (done) => {
      const randomObjectID = mongoose.Types.ObjectId();

      chai
        .request(server)
        .get(`/nft/${randomObjectID}/${collectionId}`)
        .send(requestBody)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "NFT not found against provided id"
          );
          done();
        });
    });

    it("should validate the Collection query from DB ", (done) => {
      const randomObjectID = mongoose.Types.ObjectId();

      chai
        .request(server)
        .get(`/nft/${nftId}/${randomObjectID}`)
        .send(requestBody)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "Collection not found against provided Collection Id"
          );
          done();
        });
    });

    it("should bypass the process of listening to collection factory", async () => {
      const filter = { _id: collectionId };
      const updation = {
        cloneId: 1,
        nftContractAddress: "0xd9145CCE52D386f254917e481eB44e9943F39138",
        contractType: "721",
      };
      const result = await CollectionModel.updateOne(filter, updation);

      expect(result.acknowledged).to.be.true;
      expect(result.modifiedCount).to.be.equal(1);
    });

    it("should get collection and NFT combined information", (done) => {
      chai
        .request(server)
        .get(`/nft/${nftId}/${collectionId}`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body).to.have.property("data");
          expect(Object.keys(res.body.data).length).to.be.oneOf([7, 8]);
          done();
        });
    });
  });

  describe("\nTesting route: /nft/getSingleNFT/:nftId (GET)\n", () => {
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

    it("should validate the NFT query from DB ", (done) => {
      const randomObjectID = mongoose.Types.ObjectId();

      chai
        .request(server)
        .get(`/nft//getSingleNFT/${randomObjectID}`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "No NFT found against provided nftId"
          );
          done();
        });
    });

    it("should get a single NFT", (done) => {
      chai
        .request(server)
        .get(`/nft//getSingleNFT/${nftId}`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body).to.have.property("data");
          expect(res.body.data[0]).to.have.property("_id");
          done();
        });
    });
  });

  describe("\nTesting route: /getNFTsByCollection/:collectionId/:start/:end\n", () => {
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

    it("should validate the NFT model query from DB ", (done) => {
      const randomObjectID = mongoose.Types.ObjectId();

      chai
        .request(server)
        .get(`/nft//getNFTsByCollection/${randomObjectID}/0/2`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "No NFTs were found against provided Collection Id!"
          );
          done();
        });
    });

    it("should get paginate result of NFTs with provided collectionId", (done) => {
      chai
        .request(server)
        .get(`/nft//getNFTsByCollection/${collectionId}/0/2`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body).to.have.property("data");
          expect(res.body.data.length).to.be.equal(2);
          done();
        });
    });
  });

  describe("\nTesting route: /nfts/:start/:end\n", () => {
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

    it("should validate the empty request body parameter ", (done) => {
      chai
        .request(server)
        .get(`/nft/nfts/${0}/${2}`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          console.log(res);
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "domain not found in request body!"
          );
          done();
        });
    });

    it("should get paginate result of NFTs with provided collectionId", (done) => {
      chai
        .request(server)
        .get(`/nft/nfts/${0}/${2}`)
        .send({ domain: "nike.com" })
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body).to.have.property("NFTdata");
          expect(res.body.NFTdata.length).to.be.equal(2);
          done();
        });
    });
  });

  describe("\nTesting route: /nfts/:onSale\n", () => {
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

    it("should validate the empty request body parameter ", (done) => {
      chai
        .request(server)
        .get(`/nft/nfts/${false}`)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          console.log(res);
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "domain not found in request body!"
          );
          done();
        });
    });

    it("should get paginate result of NFTs with provided collectionId", (done) => {
      chai
        .request(server)
        .get(`/nft/nfts/${false}`)
        .send({ domain: "nike.com" })
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          console.log(res);
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body).to.have.property("NFTs");
          expect(res.body.NFTs.length).to.be.equal(2);
          done();
        });
    });
  });
});
