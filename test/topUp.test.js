const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require("mongoose");
const server = require("../app");
const TopUpModel = require("../models/TopUpModel");
require("dotenv").config();
const expect = chai.expect;
chai.use(chaiHttp);

if (process.env.NODE_MODE != "test") {
    throw 'To run the tests, NODE_MODE should be set to "test" in environment variables';
}

let JWT, requestBody, user;

before(async () => {
    const CONNECTION_STRING = process.env.DATABASE_TESTING_URL;

    const isLocalhost = CONNECTION_STRING.startsWith("mongodb://localhost:27017");
    if (!isLocalhost) throw "To run the tests, connect to local mongo database";

    const connect = await mongoose.connect(CONNECTION_STRING);
    console.log("Connected to the MongoDB server");

    await connect.connection.db.dropDatabase();
    console.log("Connected database dropped");
});

describe("Test the Top-up router by performing all Top-up operations", () => {
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
                    user = res.body
                    JWT = res.body.raindropToken;
                    done();
                });
        });
    });
});

describe("\nTesting route: /top-up/ [GET]\n", () => {

    describe("Testing empty top-up collection:\n", () => {
        it("User - route: /top-up/user/history - it should return the empty array in case of no entries for in Top up model", (done) => {
            chai
                .request(server)
                .get("/top-up/user/history/")
                .auth(JWT, { type: "bearer" })
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    expect(res.body.success).to.be.eq(true),
                        expect(res.body).to.have.property("topupHistory"),
                        expect(res.body.topupHistory).to.be.eql([]),
                        done();
                });
        });
        it("Admin - route: /top-up/super-admin/history - it should return the empty array in case of no entries for in Top up model", (done) => {
            chai
                .request(server)
                .get("/top-up/super-admin/history/")
                .auth(JWT, { type: "bearer" })
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    expect(res.body.success).to.be.eq(true),
                        expect(res.body).to.have.property("topupHistory"),
                        expect(res.body.topupHistory).to.be.eql([]),
                        done();
                });
        });
    });
    describe("\nTesting Records in top-up collection:\n", () => {
        let tp
        before(async () => {
            tp = new TopUpModel({
                userId: user.userId,
                amountInUSD: 123,
                amountInMatic: "12"
            })

            tp = await tp.save()
        })
        after(async ()=>{
            await tp.delete()
        })
        it("Admin - route: /top-up/super-admin/history - it should return the all the records in Top up model", (done) => {
            chai
                .request(server)
                .get("/top-up/super-admin/history/")
                .auth(JWT, { type: "bearer" })
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    expect(res.body.success).to.be.eq(true),
                    expect(res.body).to.have.property("topupHistory"),
                    expect(res.body.topupHistory[0]).to.have.property('date'),
                    expect(res.body.topupHistory[0]).to.have.property('userId'),
                    expect(res.body.topupHistory[0]).to.have.property('amountInUSD'),
                    expect(res.body.topupHistory[0]).to.have.property('amountInMatic'),
                    done();
                });
        });
        it("User - route: /top-up/user/history, it should return the user's records in Top up model", (done) => {
            chai
                .request(server)
                .get("/top-up/user/history/")
                .auth(JWT, { type: "bearer" })
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    expect(res.body.success).to.be.eq(true),
                    expect(res.body).to.have.property("topupHistory"),
                    expect(res.body.topupHistory[0]).to.have.property('date'),
                    expect(res.body.topupHistory[0]).to.have.property('userId'),
                    expect(res.body.topupHistory[0]).to.have.property('amountInUSD'),
                    expect(res.body.topupHistory[0]).to.have.property('amountInMatic'),
                    done();
                });
        });
    })
})