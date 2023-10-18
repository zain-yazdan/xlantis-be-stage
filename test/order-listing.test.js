const chai = require("chai");
const chaiHttp = require("chai-http");
const mocha = require("mocha");
const mongoose = require("mongoose");
const server = require("../app");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const MockDate = require("mockdate");
const expect = chai.expect;
chai.use(chaiHttp);

const CollectionModel = require("../models/CollectionModel");
const NFTModel = require("../models/NFTModel");
const OrderListingModel = require("../models/OrderListingModel");
const NftModel = require("../models/NFTModel");

if (process.env.NODE_MODE != "test") {
  throw 'To run the tests, NODE_MODE should be set to "test" in environment variables';
}

let JWT,
  tempJWT,
  collectionJWT,
  requestBody,
  collectionId,
  nftIdForSale,
  ownerId;

before(async () => {
  const CONNECTION_STRING = process.env.DATABASE_TESTING_URL;

  const isLocalhost = CONNECTION_STRING.startsWith("mongodb://localhost:27017");
  if (!isLocalhost) throw "To run the tests, connect to local mongo database";

  const connect = await mongoose.connect(CONNECTION_STRING);
  console.log("Connected to the MongoDB server");

  await connect.connection.db.dropDatabase();
  console.log("Connected database dropped");
});

after(async () => {
  MockDate.reset();
});
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
      walletAddress: "0xB60E0c6fb16761687e19b8A77C7A5Ca7E64c4258",
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
      walletAddress: "0xfcb15890C3317B34AE01018eF9C6afBE171bcFe6",
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
        collectionJWT = res.body.raindropToken;
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
          totalSupply: 10
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

describe("\nTesting route: /order-listing/collection/sale (POST)\n", () => {
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
    ownerId = collection.userId;
    nftIdForSale = collection.nftId[0];
    // nftIdForAuction = collection.nftId[1];
    expect(collection).to.have.property("_id");
    expect(collection).to.have.property("nftId");
    expect(nftIdForSale).to.be.eq(collection.nftId[0]);
    // expect(nftIdForAuction).to.be.eq(collection.nftId[1]);
  });

  it("should validate required attributes are passed as request body parameters", (done) => {
    requestBody = {
      collectionId,
    };

    chai
      .request(server)
      .post("/order-listing/collection/sale")
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
      collectionId: "",
      price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/collection/sale")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "collectionId was empty in request body!"
        );
        done();
      });
  });

  it("should validate the collection query from DB ", (done) => {
    const randomObjectID = mongoose.Types.ObjectId();

    requestBody = {
      collectionId: randomObjectID,
      price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/collection/sale")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Collection not found against collection Id."
        );
        done();
      });
  });

  it("should validate the owner of collection", (done) => {
    requestBody = {
      collectionId,
      price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/collection/sale")
      .auth(collectionJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Only Owner can put Collection on sale."
        );
        done();
      });
  });

  it("should fetch nft from DB and update drop Id of NFT", async () => {
    const nft = await NftModel.updateOne(
      {
        _id: nftIdForSale,
      },
      {
        dropId: mongoose.Types.ObjectId(),
        ownerId: mongoose.Types.ObjectId(),
      }
    );
    console.log("NFT : ", nft);
    expect(nft).to.have.property("modifiedCount");
    expect(nft).to.have.property("matchedCount");
    expect(nft.modifiedCount).to.be.eq(1);
    expect(nft.matchedCount).to.be.eq(1);
  });

  it("should validate nft is not part of any drop", (done) => {
    requestBody = {
      collectionId,
      price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/collection/sale")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          `Collection cannot be put on sale because NFT ${nftIdForSale} is already on sale.`
        );
        done();
      });
  });

  it("should fetch nft from DB and update drop Id of NFT to null", async () => {
    const nft = await NftModel.updateOne(
      {
        _id: nftIdForSale,
      },
      {
        dropId: null,
      }
    );
    console.log("NFT : ", nft);
    expect(nft).to.have.property("modifiedCount");
    expect(nft).to.have.property("matchedCount");
    expect(nft.modifiedCount).to.be.eq(1);
    expect(nft.matchedCount).to.be.eq(1);
  });

  it("should validate nft not sold out from the collection", (done) => {
    requestBody = {
      collectionId,
      price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/collection/sale")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          `NFT ${nftIdForSale} already sold out.`
        );
        done();
      });
  });

  it("should fetch nft from DB and update owner ID of NFT to previous one", async () => {
    const nft = await NftModel.updateOne(
      {
        _id: nftIdForSale,
      },
      {
        ownerId: ownerId,
      }
    );
    console.log("NFT : ", nft);
    expect(nft).to.have.property("modifiedCount");
    expect(nft).to.have.property("matchedCount");
    expect(nft.modifiedCount).to.be.eq(1);
    expect(nft.matchedCount).to.be.eq(1);
  });

  // POSITIVE CASE
  it("should put collection on fixed price sale", (done) => {
    requestBody = {
      collectionId,
      price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/collection/sale")
      .send(requestBody)
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        // console.log(res)
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq(
          "Collection successfully put on sale"
        );
        done();
      });
  });

  // Negative CASE
  it("should try to put collection on fixed price sale again", (done) => {
    requestBody = {
      collectionId,
      price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/collection/sale")
      .send(requestBody)
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "This Collection is already on sale."
        );
        done();
      });
  });
});

describe("\nTesting route: /order-listing/collection/buy (POST)\n", () => {
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
      // nftId: nftIdForSale,
    };

    chai
      .request(server)
      .post("/order-listing/collection/buy")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "collectionId not found in request body!"
        );
        done();
      });
  });

  it("should validate required attributes are not passed empty in request body", (done) => {
    requestBody = {
      collectionId: "",
    };

    chai
      .request(server)
      .post("/order-listing/collection/buy")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "collectionId was empty in request body!"
        );
        done();
      });
  });

  it("should validate the nft query from DB ", (done) => {
    const randomObjectID = mongoose.Types.ObjectId();

    requestBody = {
      collectionId: randomObjectID,
    };

    chai
      .request(server)
      .post("/order-listing/collection/buy")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Collection not found against Collection Id."
        );
        done();
      });
  });

  it("should validate the owner ability to buy nft", (done) => {
    requestBody = {
      collectionId,
    };

    chai
      .request(server)
      .post("/order-listing/collection/buy")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Owner can not buy his own Collection."
        );
        done();
      });
  });
  it("should fetch collection from DB and update sale Type", async () => {
    const collection = await CollectionModel.findById(collectionId);
    await OrderListingModel.updateOne(
      { _id: collection.currentOrderListingId },
      { saleType: "auction" }
    );
    const marketplace = await OrderListingModel.findById(
      collection.currentOrderListingId
    );
    expect(marketplace).to.have.property("_id");
    expect(marketplace).to.have.property("collectionId");
    expect(marketplace.saleType).to.be.eq("auction");
  });

  it("should validate the saleType of collection", (done) => {
    requestBody = {
      collectionId,
    };

    chai
      .request(server)
      .post("/order-listing/collection/buy")
      .auth(collectionJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Collection is not on fixed price sale."
        );
        done();
      });
  });

  it("should fetch collection from DB and update sale Type", async () => {
    const collection = await CollectionModel.findById(collectionId);
    await OrderListingModel.updateOne(
      { _id: collection.currentOrderListingId },
      { saleType: "fixed-price" }
    );
    const marketplace = await OrderListingModel.findById(
      collection.currentOrderListingId
    );
    expect(marketplace).to.have.property("_id");
    expect(marketplace).to.have.property("collectionId");
    expect(marketplace.saleType).to.be.eq("fixed-price");
  });

  // POSITIVE CASE
  it("should buy the collection", (done) => {
    requestBody = {
      collectionId,
    };

    chai
      .request(server)
      .post("/order-listing/collection/buy")
      .send(requestBody)
      .auth(collectionJWT, { type: "bearer" })
      .end((err, res) => {
        console.log(res.body);
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("Collection successfully bought");
        done();
      });
  });

  // Negative CASE
  it("should try to buy collection on fixed price sale again", (done) => {
    requestBody = {
      collectionId,
    };

    chai
      .request(server)
      .post("/order-listing/collection/buy")
      .send(requestBody)
      .auth(collectionJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Collection not found in marketplace."
        );
        done();
      });
  });
});

describe("\nTesting route: /order-listing/nft/sale (POST)\n", () => {
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
    nftIdForSale = collection.nftId[0];
    // nftIdForAuction = collection.nftId[1];
    expect(collection).to.have.property("_id");
    expect(collection).to.have.property("nftId");
    expect(nftIdForSale).to.be.eq(collection.nftId[0]);
    // expect(nftIdForAuction).to.be.eq(collection.nftId[1]);
  });

  it("should validate required attributes are passed as request body parameters", (done) => {
    requestBody = {
      nftId: nftIdForSale,
    };

    chai
      .request(server)
      .post("/order-listing/nft/sale")
      .auth(collectionJWT, { type: "bearer" })
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
      price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/nft/sale")
      .auth(collectionJWT, { type: "bearer" })
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
      price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/nft/sale")
      .auth(collectionJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("NFT not found against provided id");
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

  it("should validate the owner of nft", (done) => {
    requestBody = {
      nftId: nftIdForSale,
      price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/nft/sale")
      .auth(tempJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Only Owner can put NFT on sale.");
        done();
      });
  });

  // POSITIVE CASE
  it(`should put nft on fixed price sale id ${nftIdForSale}`, (done) => {
    requestBody = {
      nftId: nftIdForSale,
      price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/nft/sale")
      .send(requestBody)
      .auth(collectionJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("NFT successfully put on sale");
        done();
      });
  });

  // Negative CASE
  it(`should try to put nft on fixed price sale id ${nftIdForSale} again`, (done) => {
    requestBody = {
      nftId: nftIdForSale,
      price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/nft/sale")
      .send(requestBody)
      .auth(collectionJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("This NFT is already on sale.");
        done();
      });
  });
});

describe("\nTesting route: /order-listing/nft/buy (POST)\n", () => {
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
      // nftId: nftIdForSale,
    };

    chai
      .request(server)
      .post("/order-listing/nft/buy")
      .auth(collectionJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("nftId not found in request body!");
        done();
      });
  });

  it("should validate required attributes are not passed empty in request body", (done) => {
    requestBody = {
      nftId: "",
      price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/nft/buy")
      .auth(collectionJWT, { type: "bearer" })
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
      price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/nft/buy")
      .auth(collectionJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("NFT not found against provided id");
        done();
      });
  });

  it("should validate the owner ability to buy nft", (done) => {
    requestBody = {
      nftId: nftIdForSale,
      price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/nft/buy")
      .auth(collectionJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Owner can not buy his own NFT.");
        done();
      });
  });
  it("should fetch nft from DB and update sale Type", async () => {
    const nft = await NFTModel.findById(nftIdForSale);
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

  it("should validate the saleType of nft", (done) => {
    requestBody = {
      nftId: nftIdForSale,
      price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/nft/buy")
      .auth(tempJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Nft is not on fixed price sale.");
        done();
      });
  });

  it("should fetch nft from DB and update sale Type", async () => {
    const nft = await NFTModel.findById(nftIdForSale);
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

  // it("should validate the price of nft", (done) => {
  // 	requestBody = {
  // 		nftId: nftIdForSale,
  // 		price: 10,
  // 	};

  // 	chai
  // 		.request(server)
  // 		.post("/order-listing/nft/buy")
  // 		.auth(tempJWT, { type: "bearer" })
  // 		.send(requestBody)
  // 		.end((err, res) => {
  // 			expect(res).to.have.status(400);
  // 			expect(res.body.success).to.be.eq(false);
  // 			expect(res.body.message).to.be.eq(
  // 				"Price is not the same as of nft price."
  // 			);
  // 			done();
  // 		});
  // });

  // POSITIVE CASE
  it(`should buy the nft id ${nftIdForSale}`, (done) => {
    requestBody = {
      nftId: nftIdForSale,
      // price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/nft/buy")
      .send(requestBody)
      .auth(tempJWT, { type: "bearer" })
      .end((err, res) => {
        // console.log('Previous owner : ', user);
        // console.log('new owner : ', tempUser);

        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        // expect(res.body.nftNewOwner).to.be.eq(tempUser);
        expect(res.body.message).to.be.eq("NFT successfully bought");
        done();
      });
  });

  // Negative CASE
  it(`should try to buy nft on fixed price sale id ${nftIdForSale} again`, (done) => {
    requestBody = {
      nftId: nftIdForSale,
      price: 100,
    };

    chai
      .request(server)
      .post("/order-listing/nft/buy")
      .send(requestBody)
      .auth(collectionJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Nft not found in marketplace.");
        done();
      });
  });
});
