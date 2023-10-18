const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require("mongoose");
const server = require("../app");
require("dotenv").config();
const jwtUtil = require("../utils/jwt");

const expect = chai.expect;
chai.use(chaiHttp);

const UserModel = require("../models/UserModel");
const EarningsModel = require("../models/EarningsModel");

if (process.env.NODE_MODE != "test") {
  throw 'To run the tests, NODE_MODE should be set to "test" in environment variables';
}

before(async () => {
  const CONNECTION_STRING = process.env.DATABASE_TESTING_URL;

  const isLocalhost = CONNECTION_STRING.startsWith("mongodb://localhost:27017");
  if (!isLocalhost) throw "To run the tests, connect to local mongo database";

  const connect = await mongoose.connect(CONNECTION_STRING);

  await connect.connection.db.dropDatabase();
});

let requestBody, superAdminJWT, adminJWT, userJWT, superAdmin, admin, user;

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

describe("Create a earnings for different users in the database", () => {
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

  it("should create the earning for super-admin in the database", async () => {
    const earning = await EarningsModel.create({
      userId: superAdmin._id,
      amount: 300,
      type: "nft-sold",
    });
    expect(earning).to.have.property("_id");
    expect(earning).to.have.property("amount");
    expect(earning.amount).to.be.eq(300);
  });

  it("should create the earning for admin in the database", async () => {
    const earning = await EarningsModel.create({
      userId: admin._id,
      amount: 200,
      type: "platform-fee",
    });
    expect(earning).to.have.property("_id");
    expect(earning).to.have.property("amount");
    expect(earning.amount).to.be.eq(200);
  });

  it("should create another earning for admin in the database", async () => {
    const earning = await EarningsModel.create({
      userId: admin._id,
      amount: 50,
      type: "platform-fee",
    });
    expect(earning).to.have.property("_id");
    expect(earning).to.have.property("amount");
    expect(earning.amount).to.be.eq(50);
  });

  it("should create the earning for user in the database", async () => {
    const earning = await EarningsModel.create({
      userId: user._id,
      amount: 100,
      type: "royalty-fee",
    });
    expect(earning).to.have.property("_id");
    expect(earning).to.have.property("amount");
    expect(earning.amount).to.be.eq(100);
  });
});

describe(`Test route: '/earnings/' [GET]`, () => {
  //POSITIVE CASE
  it("should get the super admin earnings from the database", (done) => {
    chai
      .request(server)
      .get("/earnings/")
      .auth(superAdminJWT, { type: "bearer" })
      .end((err, res) => {
        console.log(res);
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("earnings");
        expect(res.body).to.have.property("totalEarnings");
        expect(res.body.totalEarnings).to.be.eq(300);
        expect(res.body.earnings.length).to.be.eq(1);
        expect(res.body.earnings[0].amount).to.be.eq(300);
        expect(res.body.earnings[0].type).to.be.eq("nft-sold");
        done();
      });
  });

  it("should get the admin earnings from the database", (done) => {
    chai
      .request(server)
      .get("/earnings/")
      .auth(adminJWT, { type: "bearer" })
      .end((err, res) => {
        console.log(res);
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("earnings");
        expect(res.body).to.have.property("totalEarnings");
        expect(res.body.totalEarnings).to.be.eq(250);
        expect(res.body.earnings.length).to.be.eq(2);
        expect(res.body.earnings[0].amount).to.be.eq(200);
        expect(res.body.earnings[0].type).to.be.eq("platform-fee");
        done();
      });
  });

  it("should get the user earnings from the database", (done) => {
    chai
      .request(server)
      .get("/earnings/")
      .auth(userJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("earnings");
        expect(res.body).to.have.property("totalEarnings");
        expect(res.body.totalEarnings).to.be.eq(100);
        expect(res.body.earnings.length).to.be.eq(1);
        expect(res.body.earnings[0].amount).to.be.eq(100);
        expect(res.body.earnings[0].type).to.be.eq("royalty-fee");
        done();
      });
  });
});

describe(`Test route: '/earnings/:userId' [GET]`, () => {
  //POSITIVE CASE
  it("should get the earnings of admin earnings by super admin from the database", (done) => {
    chai
      .request(server)
      .get(`/earnings/${admin._id}`)
      .auth(superAdminJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("earnings");
        expect(res.body).to.have.property("totalEarnings");
        expect(res.body.totalEarnings).to.be.eq(250);
        expect(res.body.earnings.length).to.be.eq(2);
        expect(res.body.earnings[0].amount).to.be.eq(200);
        expect(res.body.earnings[0].type).to.be.eq("platform-fee");
        done();
      });
  });

  it("should get the earnings of user earnings by super admin from the database", (done) => {
    chai
      .request(server)
      .get(`/earnings/${user._id}`)
      .auth(superAdminJWT, { type: "bearer" })
      .end((err, res) => {
        console.log(res);
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("earnings");
        expect(res.body).to.have.property("totalEarnings");
        expect(res.body.totalEarnings).to.be.eq(100);
        expect(res.body.earnings.length).to.be.eq(1);
        expect(res.body.earnings[0].amount).to.be.eq(100);
        expect(res.body.earnings[0].type).to.be.eq("royalty-fee");
        done();
      });
  });
});

describe(`Test route: '/earnings/list' [GET]`, () => {
  //POSITIVE CASE
  it("should get the earnings of current user", (done) => {
    chai
      .request(server)
      .get(`/earnings/list`)
      .auth(adminJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("earnings");
        expect(res.body.earnings.length).to.be.eq(2);
        expect(res.body.earnings[0].amount).to.be.eq(200);
        expect(res.body.earnings[0]).to.have.property("createdAt");
        done();
      });
  });
});
