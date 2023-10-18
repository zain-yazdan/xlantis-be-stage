const chai = require("chai");
const chaiHttp = require("chai-http");
const mocha = require("mocha");
const mongoose = require("mongoose");
const server = require("../../app");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const MockDate = require("mockdate");
const expect = chai.expect;
chai.use(chaiHttp);

const CollectionModel = require("../models/CollectionModel");
const NFTModel = require("../models/NFTModel");
const MarketplaceModel = require("../models/MarketplaceModel");
const UserModel = require("../models/UserModel");

if (process.env.NODE_MODE != "testing") {
  throw 'To run the tests, NODE_MODE should be set to "testing" in environment variables';
}

let JWT,
  tempJWT,
  requestBody,
  collectionId,
  nftIdForSale,
  superAdminJWT,
  adminId;

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
  it("should create and login new user", (done) => {
    requestBody = {
      walletAddress: "0xE66a70d89D44754f726A4B463975d1F624530111",
      signature:
        "0x74cc1a80d9b3353b97c2c3aed6f3d936766739faf949e161f3af864cb48dbfbe284b5ad7c3064efa2b02ac35dd04103ffb73d962b5cd251d9e91c54cb4eb4ab11b",
    };

    chai
      .request(server)
      .post("/user/auth/login")
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        // expect(res.body).to.have.property("userId");
        expect(res.body).to.have.property("raindropToken");
        // expect(res.body).to.have.property("roles");
        // expect(res.body.isNewUser).to.be.eq(true);
        expect(res.body.message).to.be.eq("User created and logged in");
        JWT = res.body.raindropToken;
        user = res.body.userId;
        done();
      });
  });

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
});

describe("\nTesting route: /marketplace/nft/sale (POST)\n", () => {
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
      .post("/marketplace/nft/sale")
      .auth(tempJWT, { type: "bearer" })
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
      .post("/marketplace/nft/sale")
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
      price: 100,
    };

    chai
      .request(server)
      .post("/marketplace/nft/sale")
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
      nftId: nftIdForSale,
      price: 100,
    };

    chai
      .request(server)
      .post("/marketplace/nft/sale")
      .auth(JWT, { type: "bearer" })
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
      .post("/marketplace/nft/sale")
      .send(requestBody)
      .auth(tempJWT, { type: "bearer" })
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
      .post("/marketplace/nft/sale")
      .send(requestBody)
      .auth(tempJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("This NFT is already on sale.");
        done();
      });
  });
});

describe("\nTesting route: /marketplace/nft/buy (POST)\n", () => {
  it("should validate required attributes are passed as request body parameters", (done) => {
    requestBody = {
      // nftId: nftIdForSale,
    };

    chai
      .request(server)
      .post("/marketplace/nft/buy")
      .auth(JWT, { type: "bearer" })
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
      .post("/marketplace/nft/buy")
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
      price: 100,
    };

    chai
      .request(server)
      .post("/marketplace/nft/buy")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("NFT not found against nft Id.");
        done();
      });
  });

  it("should fetch nft from DB and update sale Type", async () => {
    const nft = await NFTModel.findById(nftIdForSale);
    await MarketplaceModel.updateOne(
      { _id: nft.currentMarketplaceId },
      { saleType: "auction" }
    );
    const marketplace = await MarketplaceModel.findById(
      nft.currentMarketplaceId
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
      .post("/marketplace/nft/buy")
      .auth(JWT, { type: "bearer" })
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
    await MarketplaceModel.updateOne(
      { _id: nft.currentMarketplaceId },
      { saleType: "fixed-price" }
    );
    const marketplace = await MarketplaceModel.findById(
      nft.currentMarketplaceId
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
  // 		.post("/marketplace/nft/buy")
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
      .post("/marketplace/nft/buy")
      .send(requestBody)
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
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
      .post("/marketplace/nft/buy")
      .send(requestBody)
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Nft not found in marketplace.");
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
      .post("/marketplace/nft/sale")
      .send(requestBody)
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("NFT successfully put on sale");
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
      .post("/marketplace/nft/buy")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Owner can not buy his own NFT.");
        done();
      });
  });
});
