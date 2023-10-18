const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require("mongoose");
const server = require("../app");
require("dotenv").config();
const jwtUtil = require("../utils/jwt");

const expect = chai.expect;
chai.use(chaiHttp);

const UserModel = require("../models/v1-sso/UserModel");
const UserModelV2 = require("../models/v2-wallet-login/UserModel");
const PlatformFeeModel = require("../models/v1-sso/PlatformFeeModel");

if (process.env.NODE_MODE != "testing") {
  throw 'To run the tests, NODE_MODE should be set to "testing" in environment variables';
}

before(async () => {
  const CONNECTION_STRING = process.env.DATABASE_TESTING_URL;

  const isLocalhost = CONNECTION_STRING.startsWith("mongodb://localhost:27017");
  if (!isLocalhost) throw "To run the tests, connect to local mongo database";

  const connect = await mongoose.connect(CONNECTION_STRING);

  await connect.connection.db.dropDatabase();
});

let requestBody, JWT, platformFeeId, superAdminJWT, admin;
describe(`Test route: '/platform-fee/admin' [POST]`, () => {
  it("should verify server is running", (done) => {
    chai
      .request(server)
      .get("/v1-sso/is-live")
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.text).to.be.eq("Server is live and running!");
        done();
      });
  });

  it("should create the admin and it JWT token in the database", async () => {
    admin = await UserModel.create({
      username: "Super-Admin",
      email: "admin@gmail.com",
      role: "admin",
      password: "$2b$10$GE0DO.MxPz6z5i1ljb/06.7qGy2sDtXyCZJz.2NO9TqlbjKR1lQ0K",
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

  it("should validate missing request body parameter", (done) => {
    chai
      .request(server)
      .post("/v1-sso/platform-fee/admin")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Platform Fee not found in request body"
        );
        done();
      });
  });

  it("should validate empty request body parameter", (done) => {
    requestBody = { platformFee: "" };

    chai
      .request(server)
      .post("/v1-sso/platform-fee/admin")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Platform Fee was empty in request body"
        );
        done();
      });
  });

  it("should validate platform fee value must be greater than 0", (done) => {
    requestBody = { platformFee: -1 };

    chai
      .request(server)
      .post("/v1-sso/platform-fee/admin")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Platform fee must be grater than 0");
        done();
      });
  });

  it("should validate platform fee value must be greater than 0", (done) => {
    requestBody = { platformFee: 101 };

    chai
      .request(server)
      .post("/v1-sso/platform-fee/admin")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Platform fee must be less than 100");
        done();
      });
  });

  //POSITIVE CASE
  it("should make a successful request for the platform fee.", (done) => {
    requestBody = { platformFee: 15 };

    chai
      .request(server)
      .post("/v1-sso/platform-fee/admin")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq(
          "Platform fee request successfully made."
        );
        done();
      });
  });
});

describe(`Test route: '/platform-fee/super-admin/accept' [PATCH]`, () => {
  it("should create the super admin in the database", async () => {
    const superAdmin = await UserModel.create({
      username: "Super-Admin",
      email: "superadmin@gmail.com",
      role: "super-admin",
      password: "$2b$10$GE0DO.MxPz6z5i1ljb/06.7qGy2sDtXyCZJz.2NO9TqlbjKR1lQ0K",
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

  it("should validate missing request body parameter", (done) => {
    chai
      .request(server)
      .patch("/v1-sso/platform-fee/super-admin/accept")
      .auth(superAdminJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Platform Fee Id not found in request body"
        );
        done();
      });
  });

  it("should validate empty request body parameter", (done) => {
    requestBody = { platformFeeId: "" };

    chai
      .request(server)
      .patch("/v1-sso/platform-fee/super-admin/accept")
      .auth(superAdminJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Platform Fee Id was empty in request body"
        );
        done();
      });
  });

  it("should validate platform fee id from the database", (done) => {
    const randomObjectID = mongoose.Types.ObjectId();
    requestBody = { platformFeeId: randomObjectID };

    chai
      .request(server)
      .patch("/v1-sso/platform-fee/super-admin/accept")
      .auth(superAdminJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Platform fee request not found.");
        done();
      });
  });

  it("should get the platform fee Id from the database", async () => {
    const fee = await PlatformFeeModel.findOne({
      userId: admin._id,
    });
    expect(fee).to.have.property("_id");
    expect(fee).to.have.property("platformFee");
    expect(fee.isAccepted).to.be.eq("pending");
    platformFeeId = fee._id;
  });

  //POSITIVE CASE
  it("should change the platform fee status from the database", (done) => {
    requestBody = { platformFeeId };

    chai
      .request(server)
      .patch("/v1-sso/platform-fee/super-admin/accept")
      .auth(superAdminJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq(
          "Platform fee successfully updated for the admin."
        );
        done();
      });
  });
});

describe(`Test route: '/platform-fee/super-admin/reject' [PATCH]`, () => {
  it("should validate missing request body parameter", (done) => {
    chai
      .request(server)
      .patch("/v1-sso/platform-fee/super-admin/reject")
      .auth(superAdminJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Platform Fee Id not found in request body"
        );
        done();
      });
  });

  it("should validate empty request body parameter", (done) => {
    requestBody = { platformFeeId: "" };

    chai
      .request(server)
      .patch("/v1-sso/platform-fee/super-admin/reject")
      .auth(superAdminJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Platform Fee Id was empty in request body"
        );
        done();
      });
  });

  it("should validate platform fee id from the database", (done) => {
    const randomObjectID = mongoose.Types.ObjectId();
    requestBody = { platformFeeId: randomObjectID };

    chai
      .request(server)
      .patch("/v1-sso/platform-fee/super-admin/reject")
      .auth(superAdminJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Platform fee request not found.");
        done();
      });
  });

  // it("should get the platform fee Id from the database", async () => {
  // 	const admin = await UserModelV2.findOne({
  // 		walletAddress: "0xFa66506c0f3D6652e5f3312AA20C7c550A4c7c3E",
  // 	});
  //     const fee = await PlatformFeeModel.findOne({
  // 		userId: admin._id,
  // 	});
  // 	expect(fee).to.have.property("_id");
  // 	expect(fee).to.have.property("platformFee");
  // 	expect(fee.isAccepted).to.be.eq("pending");
  //     platformFeeId = fee._id;
  // });

  //POSITIVE CASE
  it("should change the platform fee status from the database", (done) => {
    requestBody = { platformFeeId };

    chai
      .request(server)
      .patch("/v1-sso/platform-fee/super-admin/reject")
      .auth(superAdminJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("Platform fee rejected.");
        done();
      });
  });
});

describe(`Test route: '/platform-fee/admin/status' [GET]`, () => {
  it("should validate missing request body parameter", (done) => {
    chai
      .request(server)
      .get("/v1-sso/platform-fee/admin/status")
      .auth(superAdminJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Platform Fee Status not found in request body"
        );
        done();
      });
  });

  it("should validate empty request body parameter", (done) => {
    chai
      .request(server)
      .get("/v1-sso/platform-fee/admin/status")
      .auth(superAdminJWT, { type: "bearer" })
      .send(requestBody)
      .query({
        status: "",
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Platform Fee Status was empty in request body"
        );
        done();
      });
  });

  it("should make a successful request for the platform fee.", (done) => {
    requestBody = { platformFee: 20 };

    chai
      .request(server)
      .post("/v1-sso/platform-fee/admin")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq(
          "Platform fee request successfully made."
        );
        done();
      });
  });
  //POSITIVE CASE
  it("should get the rejected platform fee from the database", (done) => {
    chai
      .request(server)
      .get("/v1-sso/platform-fee/admin/status")
      .auth(superAdminJWT, { type: "bearer" })
      .query({
        status: "rejected",
      })
      .end((err, res) => {
        console.log(res);
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("PlatformFee");
        expect(res.body.PlatformFee.length).to.be.eq(1);
        done();
      });
  });

  it("should get the pending platform fee from the database", (done) => {
    chai
      .request(server)
      .get("/v1-sso/platform-fee/admin/status")
      .auth(superAdminJWT, { type: "bearer" })
      .query({
        status: "pending",
      })
      .end((err, res) => {
        console.log(res);
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("PlatformFee");
        expect(res.body.PlatformFee.length).to.be.eq(1);
        done();
      });
  });
});
