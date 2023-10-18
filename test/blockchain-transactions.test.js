const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require("mongoose");
const server = require("../app");
require("dotenv").config();
const BlockchainTransactions = require("../models/BlockchainTransactions");

const expect = chai.expect;
chai.use(chaiHttp);

if (process.env.NODE_MODE != "test") {
  throw 'To run the tests, NODE_MODE should be set to "test" in environment variables';
}

let JWT, requestBody;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

before(async () => {
  const CONNECTION_STRING = process.env.DATABASE_TESTING_URL;

  const isLocalhost = CONNECTION_STRING.startsWith("mongodb://localhost:27017");
  if (!isLocalhost) throw "To run the tests, connect to local mongo database";

  const connect = await mongoose.connect(CONNECTION_STRING);
  console.log("Connected to the MongoDB server");

  await connect.connection.db.dropDatabase();
  console.log("Connected database dropped");
});

describe("Test BlockchainTransactions router by performing all operations", () => {
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

describe("\nTesting route: /transactions/ [GET]\n", async () => {
  it("should return status 404 for no transactions in database", (done) => {
    chai
      .request(server)
      .get("/transactions/")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(404);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("message");
        expect(res.body.message).to.contain("No transactions");
        done();
      });
  });

  describe("\nAll transactions: /transactions/ [GET]", async () => {
    let t1, t2;
    before(async () => {
      t1 = new BlockchainTransactions({
        userId: "6423d78c11cbce7fd6786959",
        txHash:
          "0x2446f1fd773fbb9f080e674b60c6a033c7ed7427b8b9413cf28a2a4a6da9b56c",
        receipt:
          "0xb903239f8543d04b5dc1ba6579132b143087c68db1b2168786408fcbce568238",
        txFeeInUsd: 100000,
        txFeeInWei: "100000",
        to: "0x418d2223dF6f28Db91608358a2bD4204A44C2E6d",
      });
      t2 = new BlockchainTransactions({
        userId: "2222278c11cbce7fd6786959",
        txHash:
          "0x2awxx1faaaafbb9f080e674b60c6a033c7ed7427b8b9413cf28a2a4a6da9b56c",
        receipt:
          "0xt9q32x9f85v3d0tb5ec14a6279132b143087c68db1b2168786408fcbce568238",
        txFeeInUsd: 200000,
        txFeeInWei: "200000",
        to: "0x418d2223dF6f28Db91608358a2bD4204A44C2E6d",
      });
      await t1.save();
      await t2.save();
    });

    after(async () => {
      await t1.delete();
      await t2.delete();
    });

    it("should return all the transactions present in database", (done) => {
      chai
        .request(server)
        .get("/transactions/")
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body).to.have.property("transactions");
          expect(res.body.transactions[0]).to.have.property("userId");
          expect(res.body.transactions[0]).to.have.property("txHash");
          expect(res.body.transactions[0]).to.have.property("receipt");
          expect(res.body.transactions[0]).to.have.property("txFeeInUsd");
          expect(res.body.transactions[0]).to.have.property("txFeeInWei");
          expect(res.body.transactions[0]).to.have.property("to");
          expect(res.body.transactions[0]).to.have.property("createdAt");
          expect(res.body.transactions[0]).to.have.property("updatedAt");
          done();
        });
    });
  });
});
describe("\nTesting route: /transactions/by-value [GET]\n", async () => {
  let t1, t2, t3;
  before(async () => {
    t1 = new BlockchainTransactions({
      userId: "6423d78c11cbce7fd6786959",
      txHash:
        "0x2446f1fd773fbb9f080e674b60c6a033c7ed7427b8b9413cf28a2a4a6da9b56c",
      receipt:
        "0xb903239f8543d04b5dc1ba6579132b143087c68db1b2168786408fcbce568238",
      txFeeInUsd: 100000,
      txFeeInWei: "100000",
      to: "0x418d2223dF6f28Db91608358a2bD4204A44C2E6d",
    });
    t2 = new BlockchainTransactions({
      userId: "2222278c11cbce7fd6786959",
      txHash:
        "0x2awxx1faaaafbb9f080e674b60c6a033c7ed7427b8b9413cf28a2a4a6da9b56c",
      receipt:
        "0xt9q32x9f85v3d0tb5ec14a6279132b143087c68db1b2168786408fcbce568238",
      txFeeInUsd: 200000,
      txFeeInWei: "200000",
      to: "0x418d2223dF6f28Db91608358a2bD4204A44C2E6d",
    });
    t3 = new BlockchainTransactions({
      userId: "2222278c11cbce7fd6786959",
      txHash:
        "0x2awxx1faaaafbb9f080e674b60c6a033c7ed7427b8b9413cf28a2a4a6da9b56c",
      receipt:
        "0xt9q32x9f85v3d0tb5ec14a6279132b143087c68db1b2168786408fcbce568238",
      txFeeInUsd: 300000,
      txFeeInWei: "300000",
      to: "0x418d2223dF6f28Db91608358a2bD4204A44C2E6d",
    });
    await t1.save();
    await t2.save();
    await t3.save();
  });

  after(async () => {
    await t1.delete();
    await t2.delete();
    await t3.delete();
  });

  it("should throw error on undefined parameters", (done) => {
    chai
      .request(server)
      .get("/transactions/by-value")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body).to.have.property("err");
        expect(res.body.err).to.contain("undefined");
        done();
      });
  });

  it('should throw error if "high" param is missing', (done) => {
    chai
      .request(server)
      .get("/transactions/by-value?low=1")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body).to.have.property("err");
        expect(res.body.err).to.contain("high not found");
        done();
      });
  });

  it('should throw error if "low" param is missing', (done) => {
    chai
      .request(server)
      .get("/transactions/by-value?high=1")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body).to.have.property("err");
        expect(res.body.err).to.contain("low not found");
        done();
      });
  });

  it("should throw error if high is less than eq to low", (done) => {
    chai
      .request(server)
      .get("/transactions/by-value?high=1&low=1")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body).to.have.property("err");
        expect(res.body.err).to.contain("high must be greater");
        done();
      });
  });

  it("should throw error negative parameters", (done) => {
    chai
      .request(server)
      .get("/transactions/by-value?low=-1&high=2")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body).to.have.property("err");
        expect(res.body.err).to.contain("must be greater than 0");
        done();
      });
  });

  it("should return transactions in valid range", (done) => {
    chai
      .request(server)
      .get("/transactions/by-value?high=300000&low=150000")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.transactions[0].txFeeInUsd).eq(200000);
        done();
      });
  });
});

describe("\nTesting route: /transactions/count [GET]\n", async () => {
  let t1;
  before(async () => {
    t1 = new BlockchainTransactions({
      userId: "6423d78c11cbce7fd6786959",
      txHash:
        "0x2446f1fd773fbb9f080e674b60c6a033c7ed7427b8b9413cf28a2a4a6da9b56c",
      receipt:
        "0xb903239f8543d04b5dc1ba6579132b143087c68db1b2168786408fcbce568238",
      txFeeInUsd: 100000,
      txFeeInWei: "100000",
      to: "0x418d2223dF6f28Db91608358a2bD4204A44C2E6d",
    });
    await t1.save();
  });

  after(async () => {
    await t1.delete();
  });

  it("should return right count of documents in a collection", (done) => {
    chai
      .request(server)
      .get("/transactions/count")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("transactionCount");
        expect(res.body.transactionCount).to.eq(1);
        done();
      });
  });
});
describe("\nTesting route: /transactions/by-date [GET]\n", async () => {
  let t1, t2, t3;
  let d1, d2, d3, fooDate;
  before(async () => {
    t1 = new BlockchainTransactions({
      userId: "6423d78c11cbce7fd6786959",
      txHash:
        "0x2446f1fd773fbb9f080e674b60c6a033c7ed7427b8b9413cf28a2a4a6da9b56c",
      receipt:
        "0xb903239f8543d04b5dc1ba6579132b143087c68db1b2168786408fcbce568238",
      txFeeInUsd: 100000,
      txFeeInWei: "100000",
      to: "0x418d2223dF6f28Db91608358a2bD4204A44C2E6d",
    });

    await t1.save();
    d1 = new Date();

    await sleep(2000);
    t2 = new BlockchainTransactions({
      userId: "2222278c11cbce7fd6786959",
      txHash:
        "0x2awxx1faaaafbb9f080e674b60c6a033c7ed7427b8b9413cf28a2a4a6da9b56c",
      receipt:
        "0xt9q32x9f85v3d0tb5ec14a6279132b143087c68db1b2168786408fcbce568238",
      txFeeInUsd: 200000,
      txFeeInWei: "200000",
      to: "0x418d2223dF6f28Db91608358a2bD4204A44C2E6d",
    });

    await t2.save();
    d2 = new Date();

    await sleep(2000);
    t3 = new BlockchainTransactions({
      userId: "2222278c11cbce7fd6786959",
      txHash:
        "0x2awxx1faaaafbb9f080e674b60c6a033c7ed7427b8b9413cf28a2a4a6da9b56c",
      receipt:
        "0xt9q32x9f85v3d0tb5ec14a6279132b143087c68db1b2168786408fcbce568238",
      txFeeInUsd: 300000,
      txFeeInWei: "300000",
      to: "0x418d2223dF6f28Db91608358a2bD4204A44C2E6d",
    });
    await t3.save();
    d3 = new Date();
    fooDate = new Date();
  });

  after(async () => {
    await t1.delete();
    await t2.delete();
    await t3.delete();
  });

  it("should throw error on invalid parameters", (done) => {
    chai
      .request(server)
      .get(`/transactions/by-date/${undefined}/${undefined}`)
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(500);
        expect(res.body.success).to.be.eq(false);
        expect(res.body).to.have.property("err");
        expect(res.body.err.stringValue).to.eq('"Invalid Date"');
        done();
      });
  });

  it("should return not found if there are no transactions", (done) => {
    chai
      .request(server)
      .get(
        `/transactions/by-date/${fooDate.toISOString()}/${fooDate.toISOString()}`
      )
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(404);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("message");
        expect(res.body.message).to.eq("No transactions found");
        done();
      });
  });

  it("should return transactions in valid time range", (done) => {
    chai
      .request(server)
      .get(`/transactions/by-date/${d1.toISOString()}/${d2.toISOString()}/`)
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.transactions[0].txFeeInUsd).eq(200000); // t2 is returned
        done();
      });
  });
});
