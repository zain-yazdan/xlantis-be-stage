const chai = require("chai");
const chaiHttp = require("chai-http");
const mocha = require("mocha");
const mongoose = require("mongoose");
const MockDate = require("mockdate");

const server = require("../../app");
const UserModelV2 = require("../models/UserModel");

require("dotenv").config();

const expect = chai.expect;
chai.use(chaiHttp);

if (process.env.NODE_MODE != "testing") {
  throw 'To run the tests, NODE_MODE should be set to "testing" in environment variables';
}

let requestBody,
  JWT,
  tempJWT,
  tempJWT_V1,
  adminId,
  dropId,
  dropIdV1,
  superAdminJWT;

before(async () => {
  const CONNECTION_STRING = process.env.DATABASE_TESTING_URL;

  const isLocalhost = CONNECTION_STRING.startsWith("mongodb://localhost:27017");
  if (!isLocalhost) throw "To run the tests, connect to local mongo database";

  const connect = await mongoose.connect(CONNECTION_STRING);
  // console.log("Connected to the MongoDB server");

  await connect.connection.db.dropDatabase();
  console.log("Connected database dropped");
});
after(async () => {
  MockDate.reset();
});

describe(`Test route: '/super-admin/admin/verify' [PATCH]`, () => {
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
    const admin = await UserModelV2.findOne({
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

  it("should check the verifification of the admin from the database", async () => {
    const admin = await UserModelV2.findOne({
      walletAddress: "0xB60E0c6fb16761687e19b8A77C7A5Ca7E64c4258",
    });
    expect(admin).to.have.property("_id");
    expect(admin).to.have.property("walletAddress");
    expect(admin.role).to.be.eq("admin");
    expect(admin.isVerified).to.be.eq(true);
  });
});

describe(`Test route: '/super-admin/disable' [PATCH]`, () => {
  it("should validate missing request body parameter", (done) => {
    chai
      .request(server)
      .patch("/super-admin/disable")
      .auth(superAdminJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("adminId not found in request body!");
        done();
      });
  });

  it("should validate empty request body parameter", (done) => {
    requestBody = { adminId: "" };

    chai
      .request(server)
      .patch("/super-admin/disable")
      .auth(superAdminJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("adminId was empty in request body!");
        done();
      });
  });

  //POSITIVE CASE
  it("should disable the admin.", (done) => {
    requestBody = { adminId };

    chai
      .request(server)
      .patch("/super-admin/disable")
      .auth(superAdminJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("Admin status disabled.");
        done();
      });
  });

  it("should check the verification of the admin from the database", async () => {
    const admin = await UserModelV2.findOne({
      walletAddress: "0xB60E0c6fb16761687e19b8A77C7A5Ca7E64c4258",
    });
    expect(admin).to.have.property("_id");
    expect(admin).to.have.property("walletAddress");
    expect(admin.role).to.be.eq("admin");
    expect(admin.isEnabled).to.be.eq(false);
  });
});

describe(`Test route: '/super-admin/enable' [PATCH]`, () => {
  it("should validate missing request body parameter", (done) => {
    chai
      .request(server)
      .patch("/super-admin/enable")
      .auth(superAdminJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("adminId not found in request body!");
        done();
      });
  });

  it("should validate empty request body parameter", (done) => {
    requestBody = { adminId: "" };

    chai
      .request(server)
      .patch("/super-admin/enable")
      .auth(superAdminJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("adminId was empty in request body!");
        done();
      });
  });
  //POSITIVE CASE
  it("should enable the admin.", (done) => {
    requestBody = { adminId };

    chai
      .request(server)
      .patch("/super-admin/enable")
      .auth(superAdminJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("Admin status Enabled.");
        done();
      });
  });

  it("should check the verifification of the admin from the database", async () => {
    const admin = await UserModelV2.findOne({
      walletAddress: "0xB60E0c6fb16761687e19b8A77C7A5Ca7E64c4258",
    });
    expect(admin).to.have.property("_id");
    expect(admin).to.have.property("walletAddress");
    expect(admin.role).to.be.eq("admin");
    expect(admin.isEnabled).to.be.eq(true);
  });
});

describe(`Test route: '/super-admin/admins/enabled' [GET]`, () => {
  //POSITIVE CASE
  it("should get the enabled admins.", (done) => {
    chai
      .request(server)
      .get("/super-admin/admins/enabled")
      .auth(superAdminJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.have.property("admins");
        expect(res.body.admins.length).to.be.eq(1);
        done();
      });
  });
});

describe(`Test route: '/super-admin/admins/disabled' [GET]`, () => {
  it("should disable the admin.", (done) => {
    requestBody = { adminId };

    chai
      .request(server)
      .patch("/super-admin/disable")
      .auth(superAdminJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("Admin status disabled.");
        done();
      });
  });

  //POSITIVE CASE
  it("should get the disabled admins.", (done) => {
    chai
      .request(server)
      .get("/super-admin/admins/disabled")
      .auth(superAdminJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.have.property("admins");
        expect(res.body.admins.length).to.be.eq(1);
        done();
      });
  });
});

describe(`Test route: '/super-admin/admins/unverified' [GET]`, () => {
  it("should add admin by super admin", (done) => {
    requestBody = {
      walletAddress: "0x9E0C486547c75932a394174156D2672D8544e249",
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
      walletAddress: "0x9E0C486547c75932a394174156D2672D8544e249",
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

  //POSITIVE CASE
  it("should get the unverified admins.", (done) => {
    chai
      .request(server)
      .get("/super-admin/admins/unverified")
      .auth(superAdminJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.have.property("unverifiedAdmins");
        expect(res.body.unverifiedAdmins.length).to.be.eq(1);
        done();
      });
  });
});

describe(`Test route: '/super-admin/admins/unverified/:start/:end' [GET]`, () => {
  //POSITIVE CASE
  it("should get the unverified admins.", (done) => {
    chai
      .request(server)
      .get("/super-admin/admins/unverified/0/1")
      .auth(superAdminJWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.have.property("unverifiedAdmins");
        expect(res.body.unverifiedAdmins.length).to.be.eq(1);
        done();
      });
  });
});
