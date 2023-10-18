const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require("mongoose");
const MockDate = require("mockdate");

const server = require("../../app");
const path = require("path");
require("dotenv").config();

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
  JWT2,
  tempJWT,
  tempJWT2,
  requestBody,
  collectionId,
  nftId1,
  nftId2,
  nftId3,
  dropId,
  superAdminJWT,
  adminId,
  adminId2;

before(async () => {
  const CONNECTION_STRING = process.env.DATABASE_TESTING_URL;

  const isLocalhost = CONNECTION_STRING.startsWith("mongodb://localhost:27017");
  if (!isLocalhost) throw "To run the tests, connect to local mongo database";

  const connect = await mongoose.connect(CONNECTION_STRING);
  console.log("Connected to the MongoDB server");

  await connect.connection.db.dropDatabase();
  console.log("Connected database dropped");

  // existingFiles = fs.readdirSync(directory);
  // console.log({existingFiles});
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
        // user = res.body.userId;
        done();
      });
  });

  it("should create and login new user", (done) => {
    requestBody = {
      walletAddress: "0xA0716f4371230997f485745d4e5140243A187bd8",
      signature:
        "0xe264a38e7655374928cce7bd78ccd237e95f7c1624b16fd1a5c223070b746ba8076f97fcdc91136d77fedc2f022b5cca8ae4012dc94f4b62d2678fd900c74bc21b",
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
        JWT2 = res.body.raindropToken;
        // user2 = res.body.userId;
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

  it("admin should create a new collection", (done) => {
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

  it("admin should add 3 new NFTs to a collection", (done) => {
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
        {
          title: "The Demo",
          type: "Rare",
          nftFormat: "mp3",
          nftURI:
            "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/demo.mp3",
          metadataURI:
            "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/demo.json",
          previewImageURI:
            "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/demo.jpg",
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

  it("should fetch collection from DB and save NFT Id(s)", async () => {
    const collection = await CollectionModel.findById(collectionId);
    nftId1 = collection.nftId[0];
    nftId2 = collection.nftId[1];
    nftId3 = collection.nftId[2];
    expect(collection).to.have.property("_id");
    expect(collection).to.have.property("nftId");
    expect(nftId1).to.be.eq(collection.nftId[0]);
    expect(nftId2).to.be.eq(collection.nftId[1]);
    expect(nftId3).to.be.eq(collection.nftId[2]);
  });

  it(`admin should put nft on fixed price sale id`, (done) => {
    requestBody = {
      nftId: nftId1,
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

  it("should create a secondary drop", (done) => {
    requestBody = {
      title: "Temp Drop",
      image: "https://ipfs/temp-uri",
      description: "This is a temp drop, created for one Mr Jack Sparrow",
      startTime: Date.now() + 5000,
      endTime: Date.now() + 86400000,
      saleType: "fixed-price",
      dropType: "721",
    };

    chai
      .request(server)
      .post("/drop/")
      .auth(tempJWT, { type: "bearer" })
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

describe("\nTesting route: /add-to-cart/ (POST)\n", () => {
  it("should validate required attributes are passed as request body parameters", (done) => {
    requestBody = {
      // nftId: nftIdForSale,
    };

    chai
      .request(server)
      .post("/add-to-cart/")
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
    };

    chai
      .request(server)
      .post("/add-to-cart/")
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
    };

    chai
      .request(server)
      .post("/add-to-cart/")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("NFT not found against nft Id.");
        done();
      });
  });

  it("should try to add to cart the NFT that is not OnSale", (done) => {
    requestBody = {
      nftId: nftId2,
    };

    chai
      .request(server)
      .post("/add-to-cart/")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("This NFT is not on sale.");
        done();
      });
  });

  it(`should put second nft on fixed price sale id`, (done) => {
    requestBody = {
      nftId: nftId2,
      price: 200,
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

  it(`should put third nft on fixed price sale id`, (done) => {
    requestBody = {
      nftId: nftId3,
      price: 300,
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

  it("should fetch nft from DB and update sale Type", async () => {
    const nft = await NFTModel.findById(nftId2);
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
      nftId: nftId2,
    };

    chai
      .request(server)
      .post("/add-to-cart/")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Nft is not on fixed-price sale so It cannot be added to cart."
        );
        done();
      });
  });

  it("should fetch nft from DB and update sale Type", async () => {
    const nft = await NFTModel.findById(nftId2);
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

  // POSITIVE CASE
  it(`should add to cart the nft`, (done) => {
    requestBody = {
      nftId: nftId1,
    };

    chai
      .request(server)
      .post("/add-to-cart/")
      .send(requestBody)
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("NFT successfully added to Cart.");
        done();
      });
  });

  it(`should add to cart the second nft`, (done) => {
    requestBody = {
      nftId: nftId2,
    };

    chai
      .request(server)
      .post("/add-to-cart/")
      .send(requestBody)
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("NFT successfully added to Cart.");
        done();
      });
  });

  it(`should add to cart the third nft`, (done) => {
    requestBody = {
      nftId: nftId3,
    };

    chai
      .request(server)
      .post("/add-to-cart/")
      .send(requestBody)
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("NFT successfully added to Cart.");
        done();
      });
  });
});

describe("\nTesting route: /add-to-cart/ (DELETE)\n", () => {
  it("should validate required attributes are passed as request body parameters", (done) => {
    requestBody = {};

    chai
      .request(server)
      .delete("/add-to-cart/")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("NFT id not found in query params.");
        done();
      });
  });

  it("should validate required attributes are not passed empty in request body", (done) => {
    chai
      .request(server)
      .delete("/add-to-cart/")
      .auth(JWT, { type: "bearer" })
      .query({
        nftId: "",
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("NFT id empty in query params.");
        done();
      });
  });

  it("should validate the nft query from DB ", (done) => {
    const randomObjectID = mongoose.Types.ObjectId();
    chai
      .request(server)
      .delete("/add-to-cart/")
      .auth(JWT, { type: "bearer" })
      .query({
        nftId: `${randomObjectID}`,
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "NFT not found in cart against nftId."
        );
        done();
      });
  });

  it("should validate that user cannot delete another's nft from cart", (done) => {
    chai
      .request(server)
      .delete("/add-to-cart/")
      .auth(JWT2, { type: "bearer" })
      .query({
        nftId: `${nftId3}`,
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("This User did not add this item.");
        done();
      });
  });

  // POSITIVE CASE
  it(`should delete nft from the cart`, (done) => {
    chai
      .request(server)
      .delete("/add-to-cart/")
      .query({
        nftId: `${nftId3}`,
      })
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq(
          "NFT successfully Deleted from the cart."
        );
        done();
      });
  });
});

describe("\nTesting route: /add-to-cart/ (get)\n", () => {
  // POSITIVE CASE
  it(`should get nfts in the cart`, (done) => {
    chai
      .request(server)
      .get("/add-to-cart/")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("NFTs");
        expect(res.body.NFTs.length).to.be.eq(2);
        done();
      });
  });
});

describe("\nTesting route: /add-to-cart/ (get)\n", () => {
  // POSITIVE CASE
  it(`should get nfts in the cart`, (done) => {
    chai
      .request(server)
      .get("/add-to-cart/")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("NFTs");
        expect(res.body.NFTs.length).to.be.eq(2);
        done();
      });
  });
});

describe("\nTesting route: /add-to-cart/buy (POST)\n", () => {
  it("should validate If NFTs exist against this user", (done) => {
    chai
      .request(server)
      .post("/add-to-cart/buy")
      .auth(JWT2, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "NFTs not found in cart against this user."
        );
        done();
      });
  });

  // POSITIVE CASE
  it(`should buy the NFTs in the cart`, (done) => {
    chai
      .request(server)
      .post("/add-to-cart/buy")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("NFT successfully Bought.");
        expect(res.body.TotalNFTsBought).to.be.eq(2);
        done();
      });
  });

  it("should validate that owner cannot add his nft to cart", (done) => {
    requestBody = {
      nftId: nftId2,
    };

    chai
      .request(server)
      .post("/add-to-cart/")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Owner can not add NFT cart.");
        done();
      });
  });
});
