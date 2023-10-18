const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require("mongoose");
const server = require("../app");
require("dotenv").config();
const jwtUtil = require("../utils/jwt");

const expect = chai.expect;
chai.use(chaiHttp);

const UserModel = require("../models/UserModel");
const AnalyticsModel = require("../models/Analytics");
const CollectionModel = require("../models/CollectionModel");
const NFTModel = require("../models/NFTModel");
const DropModel = require("../models/DropModel");

if (process.env.NODE_MODE != "test") {
  throw 'To run the tests, NODE_MODE should be set to "testing" in environment variables';
}

before(async () => {
  const CONNECTION_STRING = process.env.DATABASE_TESTING_URL;

  const isLocalhost = CONNECTION_STRING.startsWith("mongodb://localhost:27017");
  if (!isLocalhost) throw "To run the tests, connect to local mongo database";

  const connect = await mongoose.connect(CONNECTION_STRING);

  await connect.connection.db.dropDatabase();
});

let requestBody,
  superAdminJWT,
  JWT,
  userJWT,
  superAdmin,
  admin,
  user,
  collectionId,
  nftId,
  dropId;
describe("Create a new user and login ", () => {
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

  it("should create the super admin in the database", async () => {
    superAdmin = await UserModel.create({
      username: "Super-Admin",
      email: "superadmin@gmail.com",
      role: "super-admin",
      password: "$2b$10$GE0DO.MxPz6z5i1ljb/06.7qGy2sDtXyCZJz.2NO9TqlbjKR1lQ0K",
      userType: "v1",
    });
    console.log("Super Admin : ", superAdmin);
    expect(superAdmin).to.have.property("_id");
    expect(superAdmin).to.have.property("email");
    expect(superAdmin.role).to.be.eq("super-admin");
  });

  it("should login the super admin", (done) => {
    requestBody = {
      email: "superadmin@gmail.com",
      password: "password_testing",
    };

    chai
      .request(server)
      .post("/v1-sso/user/auth/super-admin-login")
      .send(requestBody)
      .end((err, res) => {
        console.log("res : ", res);
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("Login successful.");
        expect(res.body).to.have.property("token");
        superAdminJWT = res.body.token;
        done();
      });
  });

  it("should create the admin and it JWT token in the database", async () => {
    admin = await UserModel.create({
      username: "Admin",
      email: "admin@gmail.com",
      role: "admin",
      password: "$2b$10$GE0DO.MxPz6z5i1ljb/06.7qGy2sDtXyCZJz.2NO9TqlbjKR1lQ0K",
      userType: "v1",
    });
    console.log("Admin : ", admin);
    expect(admin).to.have.property("_id");
    expect(admin).to.have.property("email");
    expect(admin.role).to.be.eq("admin");
    JWT = await jwtUtil.sign({
      email: admin.email,
      role: admin.role,
      userId: admin._id,
    });
  });

  it("should create the user and it JWT token in the database", async () => {
    user = await UserModel.create({
      username: "User",
      email: "user@gmail.com",
      role: "user",
      password: "$2b$10$GE0DO.MxPz6z5i1ljb/06.7qGy2sDtXyCZJz.2NO9TqlbjKR1lQ0K",
      userType: "v1",
    });
    expect(user).to.have.property("_id");
    expect(user).to.have.property("email");
    expect(user.role).to.be.eq("user");
    userJWT = await jwtUtil.sign({
      email: user.email,
      role: user.role,
      userId: user._id,
    });
  });
});

describe("Create nft and drop analytics in the database", () => {
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

  it("should add a new NFTs to a collection", (done) => {
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
          totalSupply: 1,
          supplyType: "Single",
          properties: {
            speed: "Fastest ship ever",
          },
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
      description: "This is a v special drop, created for one Mr Jack Sparrow",
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
    await NFTModel.updateOne(
      {
        _id: nftId,
      },
      {
        dropId: dropId,
      }
    );
    expect(nftId).to.be.eq(collection.nftId[0]);
  });
});

describe(`Test route: '/analytics/' [POST]`, () => {
  it("should validate complete request body parameters are passed", (done) => {
    chai
      .request(server)
      .post("/analytics/")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.equal(false);
        expect(res.body.message).to.be.equal(
          "viewerId not found in request body!"
        );
        done();
      });
  });
  it("should validate request body parameters are not passed empty", (done) => {
    requestBody = {
      nftId: nftId,
      viewerId: "",
      viewedAt: Date.now(),
      viewDuration: "5 minutes",
      timesSold: 1,
      soldAt: 25,
      saleDuration: "25 minutes",
    };

    chai
      .request(server)
      .post("/analytics/")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.equal(false);
        expect(res.body.message).to.be.equal(
          "viewerId was empty in request body!"
        );
        done();
      });
  });

  it("should validate nftId or drop Id passed in request body parameters", (done) => {
    requestBody = {
      nftId: "",
      viewerId: user._id,
      viewedAt: Date.now(),
      viewDuration: "5 minutes",
      timesSold: 1,
      soldAt: 25,
      saleDuration: "25 minutes",
    };

    chai
      .request(server)
      .post("/analytics/")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.equal(false);
        expect(res.body.message).to.be.equal(
          "Kindly provide a nftId or dropId."
        );
        done();
      });
  });

  //POSITIVE CASE
  it("should create the nft analytics in the database", (done) => {
    requestBody = {
      nftId: nftId,
      viewerId: user._id,
      viewedAt: Date.now(),
      viewDuration: "5 minutes",
      timesSold: 1,
      soldAt: 25,
      saleDuration: "25 minutes",
    };
    chai
      .request(server)
      .post("/analytics/")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.equal(true);
        expect(res.body.message).to.be.equal("Analytics created successfully.");
        done();
      });
  });

  it("should create the nft analytics again in the database", (done) => {
    requestBody = {
      nftId: nftId,
      viewerId: user._id,
      viewedAt: Date.now(),
      viewDuration: "5 minutes",
      timesSold: 2,
      soldAt: 30,
      saleDuration: "7 minutes",
    };
    chai
      .request(server)
      .post("/analytics/")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.equal(true);
        expect(res.body.message).to.be.equal("Analytics created successfully.");
        done();
      });
  });

  it("should create the drop analytics again in the database", (done) => {
    requestBody = {
      dropId: dropId,
      viewerId: user._id,
      viewedAt: Date.now(),
      viewDuration: "5 minutes",
      timesSold: 2,
      soldAt: 30,
      saleDuration: "7 minutes",
    };
    chai
      .request(server)
      .post("/analytics/")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.equal(true);
        expect(res.body.message).to.be.equal("Analytics created successfully.");
        done();
      });
  });
});

describe(`Test route: '/analytics/nftId/:nftId' [GET]`, () => {
  //POSITIVE CASE
  it("should get the nft analytics from the database", (done) => {
    chai
      .request(server)
      .get(`/analytics/nft/${nftId}`)
      .auth(superAdminJWT, { type: "bearer" })
      .end((err, res) => {
        console.log(res);
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("analytics");
        expect(res.body.analytics.length).to.be.eq(2);

        expect(res.body.analytics[0]).to.have.property("_id");
        expect(res.body.analytics[0]).to.have.property("nftId");
        expect(res.body.analytics[0]).to.have.property("viewerId");
        expect(res.body.analytics[0]).to.have.property("viewedAt");
        expect(res.body.analytics[0]).to.have.property("viewDuration");
        expect(res.body.analytics[0].soldAt).to.be.eq(25);

        expect(res.body.analytics[1]).to.have.property("_id");
        expect(res.body.analytics[0]).to.have.property("nftId");
        expect(res.body.analytics[1]).to.have.property("viewerId");
        expect(res.body.analytics[1]).to.have.property("viewedAt");
        expect(res.body.analytics[1]).to.have.property("viewDuration");
        expect(res.body.analytics[1].soldAt).to.be.eq(30);
        done();
      });
  });
});

describe(`Test route: '/analytics/dropId/:dropId' [GET]`, () => {
  //POSITIVE CASE
  it("should get the drop analytics from the database", (done) => {
    chai
      .request(server)
      .get(`/analytics/drop/${dropId}`)
      .auth(superAdminJWT, { type: "bearer" })
      .end((err, res) => {
        console.log(res);
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("analytics");
        expect(res.body.analytics.length).to.be.eq(1);

        expect(res.body.analytics[0]).to.have.property("_id");
        expect(res.body.analytics[0]).to.have.property("dropId");
        expect(res.body.analytics[0]).to.have.property("viewerId");
        expect(res.body.analytics[0]).to.have.property("viewedAt");
        expect(res.body.analytics[0]).to.have.property("viewDuration");
        expect(res.body.analytics[0].timesSold).to.be.eq(2);
        expect(res.body.analytics[0].soldAt).to.be.eq(30);

        done();
      });
  });
});
