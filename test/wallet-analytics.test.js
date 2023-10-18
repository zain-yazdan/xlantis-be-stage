const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require("mongoose");
const server = require("../app");
require("dotenv").config();

const expect = chai.expect;
chai.use(chaiHttp);

if (process.env.NODE_MODE != "test") {
  throw 'To run the tests, NODE_MODE should be set to "test" in environment variables';
}

let JWT, requestBody;

before(async () => {
  const CONNECTION_STRING = process.env.DATABASE_TESTING_URL;

  const isLocalhost = CONNECTION_STRING.startsWith("mongodb://localhost:27017");
  if (!isLocalhost) throw "To run the tests, connect to local mongo database";

  const connect = await mongoose.connect(CONNECTION_STRING);
  console.log("Connected to the MongoDB server");

  await connect.connection.db.dropDatabase();
  console.log("Connected database dropped");
});

describe("Test the walletAnalytics router by performing all wallet monitoring operations", () => {
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
    it("should create and login new user", (done) => {
      requestBody = {
        walletAddress: "0xA0899ead09Fba22578408551d9023F04865aA1f9",
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
          JWT = res.body.raindropToken;
          done();
        });
    });
  });
});

describe("\nTesting route: /wallet-analytics/funds/ [GET]\n", () => {
  it("should return the matic balance of the verified user", (done) => {
    chai
      .request(server)
      .get("/wallet-analytics/funds")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("maticBalance");
        expect(res.body).to.have.property("balanceInUsd");
        done();
      });
  });
});

describe("\nTesting route: /wallet-analytics/toggle-email-notifications/ [GET]\n", () => {
  it("should toggle email notifications", (done) => {
    chai
      .request(server)
      .get("/wallet-analytics/toggle-email-notifications")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("message");
        expect(res.body.message).to.contain("notification");
        done();
      });
  });
});
