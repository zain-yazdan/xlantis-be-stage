const chai = require("chai");
const chaiHttp = require("chai-http");
const mocha = require("mocha");
const mongoose = require("mongoose");
const server = require("../../app");
require("dotenv").config();

const expect = chai.expect;
chai.use(chaiHttp);

if (process.env.NODE_MODE != "testing") {
  throw 'To run the tests, NODE_MODE should be set to "testing" in environment variables';
}

before(async () => {
  const CONNECTION_STRING = process.env.DATABASE_TESTING_URL;

  const isLocalhost = CONNECTION_STRING.startsWith("mongodb://localhost:27017");
  if (!isLocalhost) throw "To run the tests, connect to local mongo database";

  const connect = await mongoose.connect(CONNECTION_STRING);
  // console.log("Connected to the MongoDB server");

  await connect.connection.db.dropDatabase();
  // console.log("Connected database dropped");
});

let requestBody, JWT;
describe("Test users router", () => {
  describe(`Test route: '/user/login' [POST]`, () => {
    it("should validate missing request body parameter", (done) => {
      chai
        .request(server)
        .post("/user/auth/login")
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "walletAddress not found in request body"
          );
          done();
        });
    });

    it("should validate empty request body parameter", (done) => {
      requestBody = { walletAddress: "", signature: "" };

      chai
        .request(server)
        .post("/user/auth/login")
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "walletAddress was empty in request body"
          );
          done();
        });
    });

    it("should validate wallet address and pink slip signatory", (done) => {
      requestBody = {
        walletAddress: "0xA0899ead09Fba22578408551d9023F04865aA1f9",
        signature:
          "0xc56439eed0a7118d3600a21e7fc52d167b919a896f0ff40597d64814529366161d563df7fa9717c2ef2aabeeaf1ee4cacf778ff16c536baa2f857eb8dc0a54511c",
      };

      chai
        .request(server)
        .post("/user/auth/login")
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(401);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "Unauthorized access: wallet address and pink slip signatory do not match"
          );
          done();
        });
    });

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
          // expect(res.body).to.have.property('userId');
          expect(res.body).to.have.property("raindropToken");
          // expect(res.body).to.have.property('roles');
          // expect(res.body.isNewUser).to.be.eq(true);
          expect(res.body.message).to.be.eq("User created and logged in");
          done();
        });
    });
    it("should login an existing user", (done) => {
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
          // expect(res.body).to.have.property('userId');
          expect(res.body).to.have.property("raindropToken");
          // expect(res.body).to.have.property('roles');
          // expect(res.body.isNewUser).to.be.eq(false);
          expect(res.body.message).to.be.eq("User logged in");
          JWT = res.body.raindropToken;
          console.log(JWT);
          done();
        });
    });
  });
  describe(`Test route: '/user/profile' [PUT]`, () => {
    it("should validate updation parameters", (done) => {
      requestBody = {
        walletAddress: "0xA0899ead09Fba22578408551d9023F04865aA1f9",
      };

      chai
        .request(server)
        .put("/user/profile")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq(
            "Updation failure: No updation parameters provided"
          );
          done();
        });
    });

    it("should update user's username", (done) => {
      requestBody = {
        walletAddress: "0xA0899ead09Fba22578408551d9023F04865aA1f9",
        username: "Jane Doe",
      };

      chai
        .request(server)
        .put("/user/profile")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq(
            "User profile updated successfully..."
          );
          done();
        });
    });
  });
});
