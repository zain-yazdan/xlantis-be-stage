const chai = require("chai");
const chaiHttp = require("chai-http");
const mocha = require("mocha");
const mongoose = require("mongoose");
const MockDate = require("mockdate");

const server = require("../app");
const UserModel = require("../models/UserModel");
const DropModel = require("../models/DropModel");
const MarketplaceModel = require("../models/MarketplaceModel");

require("dotenv").config();

const expect = chai.expect;
chai.use(chaiHttp);

if (process.env.NODE_MODE != "test") {
  throw 'To run the tests, NODE_MODE should be set to "test" in environment variables';
}

let requestBody, JWT, tempJWT, adminId, tempAdminId, dropId, templateId, marketplaceId;

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

describe(`Test route: '/user/auth/super-admin-login' [POST]`, () => {
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
    const superAdmin = await UserModel.create({
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

  it("should validate missing request body parameter", (done) => {
    chai
      .request(server)
      .post("/v1-sso/user/auth/super-admin-login")
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("email not found in request body!");
        done();
      });
  });

  it("should validate empty request body parameter", (done) => {
    requestBody = { email: "", password: "" };

    chai
      .request(server)
      .post("/v1-sso/user/auth/super-admin-login")
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("email was empty in request body!");
        done();
      });
  });

  it("should validate the email of super admin", (done) => {
    const randomObjectID = mongoose.Types.ObjectId();
    requestBody = {
      email: randomObjectID,
      password: "password_testing",
    };

    chai
      .request(server)
      .post("/v1-sso/user/auth/super-admin-login")
      .send(requestBody)
      .end((err, res) => {
        console.log("res : ", res);
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Super admin not created.");
        done();
      });
  });

  it("should validate the password of super admin", (done) => {
    requestBody = {
      email: "superadmin@gmail.com",
      password: "password",
    };

    chai
      .request(server)
      .post("/v1-sso/user/auth/super-admin-login")
      .send(requestBody)
      .end((err, res) => {
        console.log("res : ", res);
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Incorrect Password.");
        done();
      });
  });
  //POSITIVE CASE
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
        JWT = res.body.token;
        done();
      });
  });

  it("should create and login new admin", (done) => {
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
        tempJWT = res.body.raindropToken;
        done();
      });
  });

  it("should get the admin Id in the database", async () => {
    const admin = await UserModel.findOne({
      walletAddress: "0xB60E0c6fb16761687e19b8A77C7A5Ca7E64c4258",
    });
    await admin.updateOne({
      stripeAccountId: "acct_1NQ2o0R9cDmkGsZG"
    })
    console.log("admin : ", admin);
    expect(admin).to.have.property("_id");
    expect(admin).to.have.property("walletAddress");
    expect(admin.role).to.be.eq("admin");
    adminId = admin._id;
  });

  it("should create the marketplace in the database", async () => {
      const marketplace = await MarketplaceModel.create({
        adminId,
        domain: "nike.com",
        companyName: "Nike",
        industryType: "Sports Wear",
        marketplaceImage: "https://ipfs/pretty-uri",
      });
      console.log("Marketplace : ", marketplace);
      expect(marketplace).to.have.property("_id");
      expect(marketplace).to.have.property("adminId");
      expect(marketplace.domain).to.be.eq("nike.com");
      marketplaceId = marketplace._id.toString();
    });

  // it ('should signup new user', (done)=>{
  //     requestBody = {
  //         email: "abc@gmail.com",
  //         password: "1234"
  //     };

  //     chai.request(server)
  //     .post('/v1-sso/user/auth/signup')
  //     .send(requestBody)
  //     .end((err, res) => {
  //         expect(res).to.have.status(200);
  //         done();
  //     });
  // });

  // it ('should login recently created user', (done)=>{
  //     requestBody = {
  //         email: "abc@gmail.com",
  //         password: "1234"
  //     };

  //     chai.request(server)
  //     .post('/v1-sso/user/auth/login')
  //     .send(requestBody)
  //     .end((err, res) => {
  //         console.log(res)
  //         expect(res).to.have.status(200);
  //         expect(res.body.success).to.be.eq(true)
  //         expect(res.body).to.have.property('token');
  //         expect(res.body.message).to.be.eq('User Successfully logged-in');
  //         tempJWT_V1 = res.body.token;
  //         done();
  //     });
  // });
});

describe(`Test route: '/super-admin/admin/remove' [DELETE]`, () => {
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


  it("should validate missing request body parameter", (done) => {
    chai
      .request(server)
      .patch("/super-admin/admin/remove")
      .auth(JWT, { type: "bearer" })
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
      .patch("/super-admin/admin/remove")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("adminId was empty in request body!");
        done();
      });
  });

  it("should validate admin ID from db.", (done) => {
    const randomObjectID = mongoose.Types.ObjectId();
    requestBody = { adminId: randomObjectID };

    chai
      .request(server)
      .patch("/super-admin/admin/remove")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .query({
        userType: "v2",
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("user doesn't exist against this Id.");
        done();
      });
  });

  it("should create and login new admin", (done) => {
    requestBody = {
      walletAddress: "0x00503054E5b0fA7Acb7DD1a9379ceC9f66FF9041",
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
        done();
      });
  });

  it("should get admin from the database and update the isVerified flag to true", async () => {
    const admin = await UserModel.findOne({
      walletAddress: "0x00503054E5b0fA7Acb7DD1a9379ceC9f66FF9041",
    });
    const result = await admin.updateOne({
      isVerified: true
    });
    expect(result.acknowledged).to.be.equal(true);
    expect(result.matchedCount).to.be.equal(1);
    expect(result.modifiedCount).to.be.equal(1);
    tempAdminId = admin._id;
  });

  it("should try to remove the admin.", (done) => {
    requestBody = { adminId: tempAdminId };

    chai
      .request(server)
      .patch("/super-admin/admin/remove")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        console.log(res)
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("Cannot delete Admin because it verified.");
        done();
      });
  });

  it("should get admin from the database and update the isVerified flag to false", async () => {
    const admin = await UserModel.findOne({
      walletAddress: "0x00503054E5b0fA7Acb7DD1a9379ceC9f66FF9041",
    });
    const result = await admin.updateOne({
      isVerified: false
    });
    expect(result.acknowledged).to.be.equal(true);
    expect(result.matchedCount).to.be.equal(1);
    expect(result.modifiedCount).to.be.equal(1);
  });

  //POSITIVE CASE
  it("should remove the admin.", (done) => {
    requestBody = { adminId: tempAdminId };

    chai
      .request(server)
      .patch("/super-admin/admin/remove")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        console.log(res.body)
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("Admin deleted successfully");
        done();
      });
  });

  it("should check the verification of the admin from the database", async () => {
    const admin = await UserModel.findOne({
      walletAddress: "0x00503054E5b0fA7Acb7DD1a9379ceC9f66FF9041",
    });
    expect(admin).to.be.eq(null);
  });
});


describe(`Test route: '/super-admin/admin/verify' [PATCH]`, () => {
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


  it("should validate missing request body parameter", (done) => {
    chai
      .request(server)
      .patch("/super-admin/admin/verify")
      .auth(JWT, { type: "bearer" })
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
      .patch("/super-admin/admin/verify")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("adminId was empty in request body!");
        done();
      });
  });

  it("should validate admin ID from db.", (done) => {
    const randomObjectID = mongoose.Types.ObjectId();
    requestBody = { adminId: randomObjectID };

    chai
      .request(server)
      .patch("/super-admin/admin/verify")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .query({
        userType: "v2",
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("user dont exist against this Id");
        done();
      });
  });

  //POSITIVE CASE
  it("should verify the admin.", (done) => {
    requestBody = { adminId };

    chai
      .request(server)
      .patch("/super-admin/admin/verify")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .query({
        userType: "v2",
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("Admin verified.");
        done();
      });
  });

  it("should check the verifification of the admin from the database", async () => {
    const admin = await UserModel.findOne({
      walletAddress: "0xB60E0c6fb16761687e19b8A77C7A5Ca7E64c4258",
    });
    expect(admin).to.have.property("_id");
    expect(admin).to.have.property("walletAddress");
    expect(admin.role).to.be.eq("admin");
    expect(admin.isVerified).to.be.eq(true);
  });
});

describe(`Test route: '/super-admin/disable' [PATCH]`, () => {
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

  it("should validate missing request body parameter", (done) => {
    chai
      .request(server)
      .patch("/super-admin/disable")
      .auth(JWT, { type: "bearer" })
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
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("adminId was empty in request body!");
        done();
      });
  });

  it("should validate admin ID from db.", (done) => {
    const randomObjectID = mongoose.Types.ObjectId();
    requestBody = { adminId: randomObjectID };

    chai
      .request(server)
      .patch("/super-admin/disable")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .query({
        userType: "v2",
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("user dont exist against this Id");
        done();
      });
  });

  //POSITIVE CASE
  it("should disable the admin.", (done) => {
    requestBody = { adminId };

    chai
      .request(server)
      .patch("/super-admin/disable")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .query({
        userType: "v2",
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("Admin status disabled.");
        done();
      });
  });

  it("should check the verification of the admin from the database", async () => {
    const admin = await UserModel.findOne({
      walletAddress: "0xB60E0c6fb16761687e19b8A77C7A5Ca7E64c4258",
    });
    expect(admin).to.have.property("_id");
    expect(admin).to.have.property("walletAddress");
    expect(admin.role).to.be.eq("admin");
    expect(admin.isEnabled).to.be.eq(false);
  });
});

describe(`Test route: '/super-admin/enable' [PATCH]`, () => {
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

  it("should validate missing request body parameter", (done) => {
    chai
      .request(server)
      .patch("/super-admin/enable")
      .auth(JWT, { type: "bearer" })
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
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("adminId was empty in request body!");
        done();
      });
  });

  it("should validate admin ID from db.", (done) => {
    const randomObjectID = mongoose.Types.ObjectId();
    requestBody = { adminId: randomObjectID };

    chai
      .request(server)
      .patch("/super-admin/enable")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .query({
        userType: "v2",
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("user dont exist against this Id");
        done();
      });
  });

  //POSITIVE CASE
  it("should enable the admin.", (done) => {
    requestBody = { adminId };

    chai
      .request(server)
      .patch("/super-admin/enable")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .query({
        userType: "v2",
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("Admin status Enabled.");
        done();
      });
  });

  it("should check the verifification of the admin from the database", async () => {
    const admin = await UserModel.findOne({
      walletAddress: "0xB60E0c6fb16761687e19b8A77C7A5Ca7E64c4258",
    });
    console.log("ADmin data : ", admin);
    expect(admin).to.have.property("_id");
    expect(admin).to.have.property("walletAddress");
    expect(admin.role).to.be.eq("admin");
    expect(admin.isEnabled).to.be.eq(true);
  });
});

describe(`Test route: '/super-admin/admins/enabled' [GET]`, () => {
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

  it("should validate missing query parameter", (done) => {
    chai
      .request(server)
      .get("/super-admin/admins/enabled")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "User Type not found in query params."
        );
        done();
      });
  });

  it("should validate empty query parameter", (done) => {
    chai
      .request(server)
      .get("/super-admin/admins/enabled")
      .auth(JWT, { type: "bearer" })
      .query({
        userType: "",
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "User Type was empty in query params."
        );
        done();
      });
  });

  //POSITIVE CASE
  it("should get the enabled admins.", (done) => {
    chai
      .request(server)
      .get("/super-admin/admins/enabled")
      .auth(JWT, { type: "bearer" })
      .query({
        userType: "v2",
      })
      .end((err, res) => {
        console.log(res.body)
        expect(res).to.have.status(200);
        expect(res.body).to.have.property("admins");
        expect(res.body.admins.length).to.be.eq(1);
        done();
      });
  });
});

describe(`Test route: '/super-admin/admins/disabled' [GET]`, () => {
  // it("should verify server is running", (done) => {
  // 	chai
  // 		.request(server)
  // 		.get("/is-live")
  // 		.end((err, res) => {
  // 			expect(res).to.have.status(200);
  // 			expect(res.text).to.be.eq("Server is live and running!");
  // 			done();
  // 		});
  // });

  it("should disable the admin.", (done) => {
    requestBody = { adminId };

    chai
      .request(server)
      .patch("/super-admin/disable")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .query({
        userType: "v2",
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("Admin status disabled.");
        done();
      });
  });
  it("should validate missing query parameter", (done) => {
    chai
      .request(server)
      .get("/super-admin/admins/disabled")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "User Type not found in query params."
        );
        done();
      });
  });

  it("should validate empty query parameter", (done) => {
    chai
      .request(server)
      .get("/super-admin/admins/disabled")
      .auth(JWT, { type: "bearer" })
      .query({
        userType: "",
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "User Type was empty in query params."
        );
        done();
      });
  });

  //POSITIVE CASE
  it("should get the disabled admins.", (done) => {
    chai
      .request(server)
      .get("/super-admin/admins/disabled")
      .auth(JWT, { type: "bearer" })
      .query({
        userType: "v2",
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.have.property("admins");
        expect(res.body.admins.length).to.be.eq(1);
        done();
      });
  });
});

describe(`Test route: '/super-admin/admins/unverified' [GET]`, () => {
  // it("should verify server is running", (done) => {
  // 	chai
  // 		.request(server)
  // 		.get("/is-live")
  // 		.end((err, res) => {
  // 			expect(res).to.have.status(200);
  // 			expect(res.text).to.be.eq("Server is live and running!");
  // 			done();
  // 		});
  // });

  it("should create and login another new admin", (done) => {
    requestBody = {
      walletAddress: "0x9E0C486547c75932a394174156D2672D8544e249",
    };

    chai
      .request(server)
      .post("/v2-wallet-login/user/auth/admin-login")
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("raindropToken");
        expect(res.body.message).to.be.eq(
          "New admin created. Awaiting super-admin approval"
        );
        // tempJWT = res.body.raindropToken;
        done();
      });
  });

  it("should validate missing query parameter", (done) => {
    chai
      .request(server)
      .get("/super-admin/admins/unverified")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "User Type not found in query params."
        );
        done();
      });
  });

  it("should validate empty query parameter", (done) => {
    chai
      .request(server)
      .get("/super-admin/admins/unverified")
      .auth(JWT, { type: "bearer" })
      .query({
        userType: "",
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "User Type was empty in query params."
        );
        done();
      });
  });

  //POSITIVE CASE
  it("should get the unverified admins.", (done) => {
    chai
      .request(server)
      .get("/super-admin/admins/unverified")
      .auth(JWT, { type: "bearer" })
      .query({
        userType: "v2",
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.have.property("unverifiedAdmins");
        expect(res.body.unverifiedAdmins.length).to.be.eq(1);
        done();
      });
  });
});

describe(`Test route: '/super-admin/admins/unverified/:start/:end' [GET]`, () => {
  // it("should verify server is running", (done) => {
  // 	chai
  // 		.request(server)
  // 		.get("/is-live")
  // 		.end((err, res) => {
  // 			expect(res).to.have.status(200);
  // 			expect(res.text).to.be.eq("Server is live and running!");
  // 			done();
  // 		});
  // });

  it("should validate missing query parameter", (done) => {
    chai
      .request(server)
      .get("/super-admin/admins/unverified/0/1")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "User Type not found in query params."
        );
        done();
      });
  });

  it("should validate empty query parameter", (done) => {
    chai
      .request(server)
      .get("/super-admin/admins/unverified/0/1")
      .auth(JWT, { type: "bearer" })
      .query({
        userType: "",
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "User Type was empty in query params."
        );
        done();
      });
  });

  //POSITIVE CASE
  it("should get the unverified admins.", (done) => {
    chai
      .request(server)
      .get("/super-admin/admins/unverified/0/1")
      .auth(JWT, { type: "bearer" })
      .query({
        userType: "v2",
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.have.property("unverifiedAdmins");
        expect(res.body.unverifiedAdmins.length).to.be.eq(1);
        done();
      });
  });
});

describe("Testing route: /drop/feature [PATCH]", () => {
  // it ('should create and login new user', (done)=>{
  //     requestBody = { walletAddress: '0xE66a70d89D44754f726A4B463975d1F624530111' ,
  //         signature: '0x74cc1a80d9b3353b97c2c3aed6f3d936766739faf949e161f3af864cb48dbfbe284b5ad7c3064efa2b02ac35dd04103ffb73d962b5cd251d9e91c54cb4eb4ab11b',
  // 		domain:'nike.com'
  //     };

  //     chai.request(server)
  //     .post('/v2-wallet-login/user/auth/login')
  //     .send(requestBody)
  //     .end((err, res) => {
  // 		console.log(res)
  //         expect(res).to.have.status(200);
  //         expect(res.body.success).to.be.eq(true)
  //         expect(res.body).to.have.property('raindropToken');
  //         expect(res.body.message).to.be.eq('New user created. Awaiting for super-admin approval');
  //         tempJWT = res.body.raindropToken;
  //         done();
  //     });
  // });
  it("should create the drop", (done) => {
    requestBody = {
      title: "Fancy Drop",
      image: "https://ipfs/pretty-uri",
      description: "This is a v special drop, created for one Mr Jack Sparrow",
      startTime: Date.now() + 5000,
      endTime: Date.now() + 86400000,
      saleType: "auction",
      dropType: "721",
      bannerURL: "s3-banner-url",
      category: "Avatars",
      marketplaceId
    };

    chai
      .request(server)
      .post("/drop/")
      .auth(tempJWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        console.log(res.body)
        expect(res).to.have.status(200);
        expect(res.body).to.have.property("dropId");
        expect(res.body.success).to.be.equal(true);
        expect(res.body.message).to.be.equal("Drop created successfully!");
        dropId = res.body.dropId;
        done();
      });
  });

  it("should validate complete request body parameters are passed", (done) => {
    chai
      .request(server)
      .patch("/super-admin/drop/feature")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Drop Id not found in request body");
        done();
      });
  });
  it("should validate request body parameters are not sent empty passed", (done) => {
    requestBody = {
      dropId: "",
    };
    chai
      .request(server)
      .patch("/super-admin/drop/feature")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("Drop Id was empty in request body");
        done();
      });
  });

  //  it("should validate missing query parameter", (done) => {
  // 	requestBody = {
  //         dropId,
  //     }
  // 	chai
  // 		.request(server)
  // 		.patch("/super-admin/drop/feature")
  //         .auth(JWT, { type: "bearer" })
  // 		.send(requestBody)
  // 		.end((err, res) => {
  // 			expect(res).to.have.status(400);
  // 			expect(res.body.success).to.be.eq(false);
  // 			expect(res.body.message).to.be.eq(
  // 				"Drop Type not found in query params."
  // 			);
  // 			done();
  // 		});
  // });

  // it("should validate empty query parameter", (done) => {
  // 	requestBody = {
  //         dropId,
  //     }
  // 	chai
  // 		.request(server)
  // 		.patch("/super-admin/drop/feature")
  // 		.auth(JWT, { type: "bearer" })
  // 		.send(requestBody)
  //         .query({
  //             dropType:""
  //         })
  // 		.end((err, res) => {
  // 			expect(res).to.have.status(400);
  // 			expect(res.body.success).to.be.eq(false);
  // 			expect(res.body.message).to.be.eq(
  // 				"Drop Type empty in query params."
  // 			);
  // 			done();
  // 		});
  // });

  it("should validate the drop query from DB ", (done) => {
    const fakeId = mongoose.Types.ObjectId();
    requestBody = {
      dropId: fakeId,
    };

    chai
      .request(server)
      .patch("/super-admin/drop/feature")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .query({
        dropType: "v2",
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.equal(false);
        expect(res.body.message).to.be.equal("Drop not found against drop Id.");
        done();
      });
  });
  // it('should validate the drop query from drop type ', (done) => {
  //     requestBody = {
  //         dropId
  //     }

  //    	chai.request(server)
  //     .patch('/super-admin/drop/feature')
  //     .auth(JWT, { type: 'bearer' })
  // 	.send(requestBody)
  // 	.query({
  // 		dropType: "v1"
  // 	})
  //     .end((err, res) => {
  //         expect(res).to.have.status(400);
  //         expect(res.body.success).to.be.equal(false);
  //         expect(res.body.message).to.be.equal('Drop not found against drop Id.');
  //         done();
  //     });
  // });

  //POSITIVE CASE
  it("should feature the drop", (done) => {
    requestBody = {
      dropId,
    };

    chai
      .request(server)
      .patch("/super-admin/drop/feature")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      // .query({
      // 	dropType: "v2"
      // })
      .end((err, res) => {
        // console.log(res);
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.equal(true);
        expect(res.body.message).to.be.equal("Drop Featured successfully.");
        done();
      });
  });

  //NEGATIVE CASE
  it("should try to feature the drop again", (done) => {
    requestBody = {
      dropId,
    };

    chai
      .request(server)
      .patch("/super-admin/drop/feature")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      // .query({
      // 	dropType: "v2"
      // })
      .end((err, res) => {
        // console.log(res)
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.equal(false);
        expect(res.body.message).to.be.equal("Drop already featured.");
        done();
      });
  });

  // it ('should create another the drop', (done) => {
  //     requestBody = {
  //         title: 'Simple Drop',
  //         image: 'https://ipfs/simple-uri',
  //         description: 'This is a v special drop, created for one Mr Jack Sparrow',
  //         startTime: Date.now() + 5000,
  //         endTime: Date.now() + 86400000,
  //         saleType: 'fixed-price',
  //         dropType: '1155'
  //     }

  //     chai.request(server)
  //     .post('/drop/')
  //     .auth(tempJWT_V1, {type: 'bearer'})
  //     .send(requestBody)
  //     .end((err, res) => {
  //         expect(res).to.have.status(200);
  //         expect(res.body).to.have.property('dropId');
  //         expect(res.body.success).to.be.equal(true);
  //         expect(res.body.message).to.be.equal('Drop created successfully!');
  //         dropIdV1 = res.body.dropId;
  //         done();
  //     });
  // });
  // it('should feature the V1 drop', (done) => {
  //     requestBody = {
  //         dropId: dropIdV1
  //     }

  //     chai.request(server)
  //     .patch('/super-admin/drop/feature')
  //     .auth(JWT, { type: 'bearer' })
  // 	.send(requestBody)
  // 	.query({
  // 		dropType: "v1"
  // 	})
  //     .end((err, res) => {
  //         // console.log(res)
  //         expect(res).to.have.status(200);
  //         expect(res.body.success).to.be.equal(true);
  //         expect(res.body.message).to.be.equal('Drop Featured successfully.');
  //         done();
  //     });
  // });
  // it("should validate isFeaturedSuperAdmin flag is false for first drop",  (done) => {
  // 	requestBody = {
  //         dropId
  //     }

  //     chai.request(server)
  //     .get(`/v2-wallet-login/drop/${dropId}`)
  //     .auth(tempJWT, { type: 'bearer' })
  // 	.send(requestBody)

  //     .end((err, res) => {
  //         // console.log(res)
  //         expect(res).to.have.status(200);
  //         expect(res.body.success).to.be.equal(true);
  //         expect(res.body).to.have.property("dropData");
  //         expect(res.body.dropData.isFeaturedSuperAdmin).to.be.equal(false);
  //         done();
  //     });
  // });
});

describe("Testing route: /drop/feature [GET]", () => {
  //  it("should validate missing query parameter", (done) => {

  // 	chai
  // 		.request(server)
  // 		.get("/super-admin/drop/feature")
  //         .auth(JWT, { type: "bearer" })
  // 		.end((err, res) => {
  // 			expect(res).to.have.status(400);
  // 			expect(res.body.success).to.be.eq(false);
  // 			expect(res.body.message).to.be.eq(
  // 				"Drop Type not found in query params."
  // 			);
  // 			done();
  // 		});
  // });

  // it("should validate empty query parameter", (done) => {

  // 	chai
  // 		.request(server)
  // 		.get("/super-admin/drop/feature")
  // 		.auth(JWT, { type: "bearer" })
  //         .query({
  //             dropType:""
  //         })
  // 		.end((err, res) => {
  // 			expect(res).to.have.status(400);
  // 			expect(res.body.success).to.be.eq(false);
  // 			expect(res.body.message).to.be.eq(
  // 				"Drop Type empty in query params."
  // 			);
  // 			done();
  // 		});
  // });

  it("should get the featured drop", (done) => {
    chai
      .request(server)
      .get("/super-admin/drop/feature")
      .auth(JWT, { type: "bearer" })
      .query({
        dropType: "v1",
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.equal(true);
        expect(res.body).to.have.property("FeaturedDrop");
        expect(res.body.FeaturedDrop.isFeaturedSuperAdmin).to.be.equal(true);
        done();
      });
  });
});

// describe(`Test route: '/super-admin/template' [POST]`, () => {
//   it("should verify server is running", (done) => {
//     chai
//       .request(server)
//       .get("/is-live")
//       .end((err, res) => {
//         expect(res).to.have.status(200);
//         expect(res.text).to.be.eq("Server is live and running!");
//         done();
//       });
//   });

//   it("should validate missing request body parameter", (done) => {
//     requestBody = {
//       name: "Cars",
//     };
//     chai
//       .request(server)
//       .post("/super-admin/template")
//       .auth(JWT, { type: "bearer" })
//       .send(requestBody)
//       .end((err, res) => {
//         console.log(res);
//         expect(res).to.have.status(400);
//         expect(res.body.success).to.be.eq(false);
//         expect(res.body.message).to.be.eq(
//           "Data array not found in request body"
//         );
//         done();
//       });
//   });

//   it("should validate empty request body parameter", (done) => {
//     requestBody = {
//       name: "",
//       data: [
//         {
//           key: "Company",
//           type: "String",
//         },
//       ],
//     };

//     chai
//       .request(server)
//       .post("/super-admin/template")
//       .auth(JWT, { type: "bearer" })
//       .send(requestBody)
//       .end((err, res) => {
//         expect(res).to.have.status(400);
//         expect(res.body.success).to.be.eq(false);
//         expect(res.body.message).to.be.eq("name was empty in request body");
//         done();
//       });
//   });

//   it("should validate missing key in data array in request body parameter", (done) => {
//     requestBody = {
//       name: "Cars",
//       data: [
//         {
//           type: "String",
//         },
//       ],
//     };

//     chai
//       .request(server)
//       .post("/super-admin/template")
//       .auth(JWT, { type: "bearer" })
//       .send(requestBody)
//       .end((err, res) => {
//         expect(res).to.have.status(400);
//         expect(res.body.success).to.be.eq(false);
//         expect(res.body.message).to.be.eq(
//           "key not found in request body of Key number: 1!"
//         );
//         done();
//       });
//   });

//   it("should validate empty key in data array in request body parameter", (done) => {
//     requestBody = {
//       name: "Cars",
//       data: [
//         {
//           key: "",
//           type: "String",
//         },
//       ],
//     };

//     chai
//       .request(server)
//       .post("/super-admin/template")
//       .auth(JWT, { type: "bearer" })
//       .send(requestBody)
//       .end((err, res) => {
//         expect(res).to.have.status(400);
//         expect(res.body.success).to.be.eq(false);
//         expect(res.body.message).to.be.eq(
//           "key was empty in request body of Key number: 1!"
//         );
//         done();
//       });
//   });

//   //POSITIVE CASE
//   it("should create the new template.", (done) => {
//     requestBody = {
//       name: "Cars",
//       data: [
//         {
//           key: "Company",
//           type: "String",
//         },
//       ],
//     };
//     chai
//       .request(server)
//       .post("/super-admin/template")
//       .auth(JWT, { type: "bearer" })
//       .send(requestBody)

//       .end((err, res) => {
//         expect(res).to.have.status(200);
//         expect(res.body.success).to.be.eq(true);
//         expect(res.body.message).to.be.eq("Template created successfully.");
//         done();
//       });
//   });
// });

// describe(`Test route: '/super-admin/template' [GET]`, () => {
//   it("should verify server is running", (done) => {
//     chai
//       .request(server)
//       .get("/is-live")
//       .end((err, res) => {
//         expect(res).to.have.status(200);
//         expect(res.text).to.be.eq("Server is live and running!");
//         done();
//       });
//   });

//   //POSITIVE CASE
//   it("should get the templates.", (done) => {
//     chai
//       .request(server)
//       .get("/super-admin/template")
//       .auth(JWT, { type: "bearer" })
//       .end((err, res) => {
//         expect(res).to.have.status(200);
//         expect(res.body.success).to.be.eq(true);
//         expect(res.body).to.have.property("templates");
//         expect(res.body.templates.length).to.be.eq(1);
//         templateId = res.body.templates[0]._id;
//         done();
//       });
//   });
// });

// describe(`Test route: '/super-admin/template' [PUT]`, () => {
//   it("should verify server is running", (done) => {
//     chai
//       .request(server)
//       .get("/is-live")
//       .end((err, res) => {
//         expect(res).to.have.status(200);
//         expect(res.text).to.be.eq("Server is live and running!");
//         done();
//       });
//   });

//   it("should validate missing request body parameter", (done) => {
//     chai
//       .request(server)
//       .put("/super-admin/template")
//       .auth(JWT, { type: "bearer" })
//       .end((err, res) => {
//         console.log(res);
//         expect(res).to.have.status(400);
//         expect(res.body.success).to.be.eq(false);
//         expect(res.body.message).to.be.eq(
//           "templateId not found in request body"
//         );
//         done();
//       });
//   });

//   it("should validate empty request body parameter", (done) => {
//     requestBody = {
//       templateId: "",
//     };

//     chai
//       .request(server)
//       .put("/super-admin/template")
//       .auth(JWT, { type: "bearer" })
//       .send(requestBody)
//       .end((err, res) => {
//         expect(res).to.have.status(400);
//         expect(res.body.success).to.be.eq(false);
//         expect(res.body.message).to.be.eq(
//           "templateId was empty in request body"
//         );
//         done();
//       });
//   });

//   it("should validate admin ID from db.", (done) => {
//     const randomObjectID = mongoose.Types.ObjectId();
//     requestBody = { templateId: randomObjectID };

//     chai
//       .request(server)
//       .put("/super-admin/template")
//       .auth(JWT, { type: "bearer" })
//       .send(requestBody)

//       .end((err, res) => {
//         expect(res).to.have.status(400);
//         expect(res.body.success).to.be.eq(false);
//         expect(res.body.message).to.be.eq(
//           "Template not found against given ID."
//         );
//         done();
//       });
//   });

//   //POSITIVE CASE
//   it("should update the name the template.", (done) => {
//     requestBody = {
//       templateId,
//       name: "Bikes",
//       data: [
//         {
//           key: "Company",
//           type: "String",
//         },
//       ],
//     };
//     chai
//       .request(server)
//       .put("/super-admin/template")
//       .auth(JWT, { type: "bearer" })
//       .send(requestBody)

//       .end((err, res) => {
//         expect(res).to.have.status(200);
//         expect(res.body.success).to.be.eq(true);
//         expect(res.body.message).to.be.eq("Template updated successfully.");
//         done();
//       });
//   });

//   it("should add a new field in the existing template.", (done) => {
//     requestBody = {
//       templateId,
//       name: "Bikes",
//       data: [
//         {
//           key: "Company",
//           type: "String",
//         },
//         {
//           key: "Model",
//           type: "String",
//         },
//       ],
//     };
//     chai
//       .request(server)
//       .put("/super-admin/template")
//       .auth(JWT, { type: "bearer" })
//       .send(requestBody)

//       .end((err, res) => {
//         expect(res).to.have.status(200);
//         expect(res.body.success).to.be.eq(true);
//         expect(res.body.message).to.be.eq("Template updated successfully.");
//         done();
//       });
//   });

//   it("should get the template and check the updates.", (done) => {
//     chai
//       .request(server)
//       .get("/super-admin/template")
//       .auth(JWT, { type: "bearer" })
//       .end((err, res) => {
//         expect(res).to.have.status(200);
//         expect(res.body.success).to.be.eq(true);
//         expect(res.body).to.have.property("templates");
//         expect(res.body.templates.length).to.be.eq(1);
//         expect(res.body.templates[0].name).to.be.eq("Bikes");
//         expect(res.body.templates[0].properties.length).to.be.eq(2);
//         done();
//       });
//   });
// });

describe("Testing route: /marketplace/feature [PATCH]", () => {
  it("should validate complete request body parameters are passed", (done) => {
    chai
      .request(server)
      .patch("/super-admin/marketplace/feature")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Marketplace Id not found in request body"
        );
        done();
      });
  });
  it("should validate request body parameters are not sent empty passed", (done) => {
    requestBody = {
      marketplaceId: "",
    };
    chai
      .request(server)
      .patch("/super-admin/marketplace/feature")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "Marketplace Id was empty in request body"
        );
        done();
      });
  });

  it("should validate the drop query from DB ", (done) => {
    const fakeId = mongoose.Types.ObjectId();
    requestBody = {
      marketplaceId: fakeId,
    };

    chai
      .request(server)
      .patch("/super-admin/marketplace/feature")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)

      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.equal(false);
        expect(res.body.message).to.be.equal(
          "Marketplace Data dont exist against this Id."
        );
        done();
      });
  });

  //POSITIVE CASE
  it("should feature the marketplace", (done) => {
    requestBody = {
      marketplaceId: adminId,
    };

    chai
      .request(server)
      .patch("/super-admin/marketplace/feature")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      // .query({
      // 	dropType: "v2"
      // })
      .end((err, res) => {
        // console.log(res);
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.equal(true);
        expect(res.body.message).to.be.equal(
          "Marketplace featured successfully."
        );
        done();
      });
  });

  //NEGATIVE CASE
  it("should try to feature the marketplace again", (done) => {
    requestBody = {
      marketplaceId: adminId,
    };

    chai
      .request(server)
      .patch("/super-admin/marketplace/feature")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)

      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.equal(false);
        expect(res.body.message).to.be.equal("Marketplace already featured.");
        done();
      });
  });
});
describe("Testing route: /super-admin/balance [GET]", () => {
  it("should return Matic and fiat balance of super and master wallet", (done) => {
    chai
      .request(server)
      .get("/super-admin/balance")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.superAdmin).to.have.property("usd");
        expect(res.body.superAdmin).to.have.property("matic");
        expect(res.body.masterWallet).to.have.property("usd");
        expect(res.body.masterWallet).to.have.property("matic");
        expect(res.body.superAdmin.usd).to.be.a('number');
        expect(res.body.masterWallet.usd).to.be.a('number');
        done();
      });
  });
});