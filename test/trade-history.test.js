const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require("mongoose");
const server = require("../app");
require("dotenv").config();
const jwtUtil = require("../utils/jwt");

const expect = chai.expect;
chai.use(chaiHttp);

const UserModel = require("../models/UserModel");
const TradeHistoryModel = require("../models/TradeHistory");

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

let requestBody, superAdminJWT, adminJWT, userJWT, superAdmin, admin, user;
let nftId = mongoose.Types.ObjectId();
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
      walletAddress: "0xFa66506c0f3D6652e5f3312AA20C7c550A4c7c3E"
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
      walletAddress: "0xB60E0c6fb16761687e19b8A77C7A5Ca7E64c4258"
    });
    console.log("Admin : ", admin);
    expect(admin).to.have.property("_id");
    expect(admin).to.have.property("email");
    expect(admin.role).to.be.eq("admin");
    adminJWT = await jwtUtil.sign({
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

describe("Create trade history for different users in the database", () => {
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

  it("should create the trade for super-admin in the database", async () => {
    const history = await TradeHistoryModel.create({
      sellerId: superAdmin._id,
      buyerId: admin._id,
      nftId,
      soldAt: Date.now(),
      saleType: "fixed-price",
      unitPrice: 300
    });
    expect(history).to.have.property("_id");
    expect(history).to.have.property("soldAt");
    expect(history).to.have.property("sellerId");
    expect(history).to.have.property("buyerId");
    expect(history.unitPrice).to.be.eq(300);
  });

  it("should create the history for admin in the database", async () => {
    const history = await TradeHistoryModel.create({
      sellerId: admin._id,
      buyerId: user._id,
      nftId,
      soldAt: Date.now(),
      saleType: "auction",
      unitPrice: 400
    });
    expect(history).to.have.property("_id");
    expect(history).to.have.property("soldAt");
    expect(history).to.have.property("sellerId");
    expect(history).to.have.property("buyerId");
    expect(history.unitPrice).to.be.eq(400);
  });
});

describe(`Test route: '/history/trade/nftId' [GET]`, () => {
  //POSITIVE CASE
  it("should get the nft trade history from the database", (done) => {
    chai
      .request(server)
      .get(`/history/trade/${nftId}`)
      .auth(superAdminJWT, { type: "bearer" })
      .end((err, res) => {
        console.log(res);
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("history");
        expect(res.body.history.length).to.be.eq(2);

        expect(res.body.history[0]).to.have.property("_id");
        expect(res.body.history[0]).to.have.property("sellerId");
        expect(res.body.history[0]).to.have.property("buyerId");
        expect(res.body.history[0]).to.have.property("soldAt");
        expect(res.body.history[0].saleType).to.be.eq("fixed-price");
        expect(res.body.history[0].unitPrice).to.be.eq(300);

        expect(res.body.history[1]).to.have.property("_id");
        expect(res.body.history[1]).to.have.property("sellerId");
        expect(res.body.history[1]).to.have.property("buyerId");
        expect(res.body.history[1]).to.have.property("soldAt");
        expect(res.body.history[1].saleType).to.be.eq("auction");
        expect(res.body.history[1].unitPrice).to.be.eq(400);
        done();
      });
  });
});
