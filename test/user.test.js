const chai = require("chai");
const chaiHttp = require("chai-http");
const mocha = require("mocha");
const mongoose = require("mongoose");
const MockDate = require("mockdate");

const server = require("../app");
const collectionModel = require("../models/CollectionModel");
const UserModel = require("../models/UserModel");

require("dotenv").config();

const expect = chai.expect;
chai.use(chaiHttp);

if (process.env.NODE_MODE != "test") {
  throw 'To run the tests, NODE_MODE should be set to "test" in environment variables';
}

let requestBody,
  JWT,
  tempJWT,
  collectionId,
  collectionId2,
  nftId,
  nftId2,
  nftId3,
  nftId4,
  bidIdForAuction;

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

describe("Test users router", () => {
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
        password:
          "$2b$10$GE0DO.MxPz6z5i1ljb/06.7qGy2sDtXyCZJz.2NO9TqlbjKR1lQ0K",
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
        .post("/v2-wallet-login/user/auth/login")
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
      requestBody = { walletAddress: "", signature: "", domain: "" };

      chai
        .request(server)
        .post("/v2-wallet-login/user/auth/login")
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

    // it("should validate wallet address and pink slip signatory", (done) => {
    // 	requestBody = {
    // 		walletAddress: "0xA0899ead09Fba22578408551d9023F04865aA1f9",
    // 		signature:
    // 			"0xc56439eed0a7118d3600a21e7fc52d167b919a896f0ff40597d64814529366161d563df7fa9717c2ef2aabeeaf1ee4cacf778ff16c536baa2f857eb8dc0a54511c",
    // 	};

    // 	chai
    // 		.request(server)
    // 		.post("/user/login")
    // 		.send(requestBody)
    // 		.end((err, res) => {
    // 			expect(res).to.have.status(401);
    // 			expect(res.body.success).to.be.eq(false);
    // 			expect(res.body.message).to.be.eq(
    // 				"Unauthorized access: wallet address and pink slip signatory do not match"
    // 			);
    // 			done();
    // 		});
    // });

    it("should create and login new user", (done) => {
      requestBody = {
        walletAddress: "0xE66a70d89D44754f726A4B463975d1F624530111",
        signature:
          "0x74cc1a80d9b3353b97c2c3aed6f3d936766739faf949e161f3af864cb48dbfbe284b5ad7c3064efa2b02ac35dd04103ffb73d962b5cd251d9e91c54cb4eb4ab11b",
        domain: "nike.com",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/user/auth/login")
        .send(requestBody)
        .end((err, res) => {
          console.log("res : ", res);
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          // expect(res.body).to.have.property("userId");
          expect(res.body).to.have.property("token");
          // expect(res.body).to.have.property("roles");
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
        .post("/v2-wallet-login/user/auth/login")
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          // expect(res.body).to.have.property("userId");
          expect(res.body).to.have.property("token");
          // expect(res.body).to.have.property("roles");
          // expect(res.body.isNewUser).to.be.eq(false);
          expect(res.body.message).to.be.eq("User logged in");
          JWT = res.body.token;
          console.log(JWT);
          done();
        });
    });

    // it("should signup new admin", (done) => {
    // 	requestBody = {
    // 		username: "Sample Admin",
    // 		email: "sampleadmin@gmail.com",
    // 		password: "1234"

    // 	};
    // 	chai
    // 		.request(server)
    // 		.post("/user/admin/signup")
    // 		.send(requestBody)
    // 		.end((err, res) => {
    // 			console.log(res)
    // 			expect(res).to.have.status(200);
    // 			expect(res.body.success).to.be.eq(true);
    // 			expect(res.body.message).to.be.eq("Admin Successfully Signed-up");
    // 			done();
    // 		});
    // });

    // it("should login existing admin", (done) => {
    // 	requestBody = {
    // 		email: "sampleadmin@gmail.com",
    // 		password: "1234"
    // 	};

    // 	chai
    // 		.request(server)
    // 		.post("/user/admin/login")
    // 		.send(requestBody)
    // 		.end((err, res) => {
    // 			console.log(res)
    // 			expect(res).to.have.status(200);
    // 			expect(res.body.success).to.be.eq(true);
    // 			expect(res.body).to.have.property("token");
    // 			expect(res.body.message).to.be.eq("Admin Successfully logged-in");
    // 			JWT = res.body.token;
    // 			done();
    // 		});
    // });

    // it("should change user role to admin", async () => {
    // 	requestBody = {
    // 		walletAddress: "0xE66a70d89D44754f726A4B463975d1F624530111",
    // 	};
    // 	await UserModel.updateOne(
    // 	{ walletAddress: requestBody.walletAddress },
    // 	{ role: "admin",
    // 	  email:"sampleadmin@gmail.com" }
    // 	);
    // 	const user = await UserModel.findOne({walletAddress: requestBody.walletAddress});
    // 	console.log("user : ",user)
    //     expect(user).to.have.property('_id');
    //     expect(user.role).to.be.eq("admin");
    // });
  });
  describe(`Test route: '/user/profile' [PUT]`, () => {
    it("should validate updation parameters", (done) => {
      requestBody = {
        walletAddress: "0xA0899ead09Fba22578408551d9023F04865aA1f9",
      };

      chai
        .request(server)
        .put("/v2-wallet-login/user/profile")
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
        .put("/v2-wallet-login/user/profile")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq("User updated successfully");
          done();
        });
    });
  });
  describe(`Test route: '/user/login' [POST]`, () => {
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
        .post("/v2-wallet-login/user/auth/login")
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
        .post("/v2-wallet-login/user/auth/login")
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

    // it("should validate wallet address and pink slip signatory", (done) => {
    // 	requestBody = {
    // 		walletAddress: "0xA0899ead09Fba22578408551d9023F04865aA1f9",
    // 		signature:
    // 			"0xc56439eed0a7118d3600a21e7fc52d167b919a896f0ff40597d64814529366161d563df7fa9717c2ef2aabeeaf1ee4cacf778ff16c536baa2f857eb8dc0a54511c",
    // 	};

    // 	chai
    // 		.request(server)
    // 		.post("/user/login")
    // 		.send(requestBody)
    // 		.end((err, res) => {
    // 			expect(res).to.have.status(401);
    // 			expect(res.body.success).to.be.eq(false);
    // 			expect(res.body.message).to.be.eq(
    // 				"Unauthorized access: wallet address and pink slip signatory do not match"
    // 			);
    // 			done();
    // 		});
    // });

    it("should create and login new user", (done) => {
      requestBody = {
        walletAddress: "0xE66a70d89D44754f726A4B463975d1F624530111",
        signature:
          "0x74cc1a80d9b3353b97c2c3aed6f3d936766739faf949e161f3af864cb48dbfbe284b5ad7c3064efa2b02ac35dd04103ffb73d962b5cd251d9e91c54cb4eb4ab11b",
      };

      chai
        .request(server)
        .post("/v2-wallet-login/user/auth/login")
        .send(requestBody)
        .end((err, res) => {
          console.log("res : ", res);
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          // expect(res.body).to.have.property("userId");
          expect(res.body).to.have.property("token");
          // expect(res.body).to.have.property("roles");
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
        .post("/v2-wallet-login/user/auth/login")
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          // expect(res.body).to.have.property("userId");
          expect(res.body).to.have.property("token");
          // expect(res.body).to.have.property("roles");
          // expect(res.body.isNewUser).to.be.eq(false);
          expect(res.body.message).to.be.eq("User logged in");
          JWT = res.body.token;
          console.log(JWT);
          done();
        });
    });

    // it("should signup new admin", (done) => {
    // 	requestBody = {
    // 		username: "Sample Admin",
    // 		email: "sampleadmin@gmail.com",
    // 		password: "1234"

    // 	};
    // 	chai
    // 		.request(server)
    // 		.post("/user/admin/signup")
    // 		.send(requestBody)
    // 		.end((err, res) => {
    // 			console.log(res)
    // 			expect(res).to.have.status(200);
    // 			expect(res.body.success).to.be.eq(true);
    // 			expect(res.body.message).to.be.eq("Admin Successfully Signed-up");
    // 			done();
    // 		});
    // });

    // it("should login existing admin", (done) => {
    // 	requestBody = {
    // 		email: "sampleadmin@gmail.com",
    // 		password: "1234"
    // 	};

    // 	chai
    // 		.request(server)
    // 		.post("/user/admin/login")
    // 		.send(requestBody)
    // 		.end((err, res) => {
    // 			console.log(res)
    // 			expect(res).to.have.status(200);
    // 			expect(res.body.success).to.be.eq(true);
    // 			expect(res.body).to.have.property("token");
    // 			expect(res.body.message).to.be.eq("Admin Successfully logged-in");
    // 			JWT = res.body.token;
    // 			done();
    // 		});
    // });

    // it("should change user role to admin", async () => {
    // 	requestBody = {
    // 		walletAddress: "0xE66a70d89D44754f726A4B463975d1F624530111",
    // 	};
    // 	await UserModel.updateOne(
    // 	{ walletAddress: requestBody.walletAddress },
    // 	{ role: "admin",
    // 	  email:"sampleadmin@gmail.com" }
    // 	);
    // 	const user = await UserModel.findOne({walletAddress: requestBody.walletAddress});
    // 	console.log("user : ",user)
    //     expect(user).to.have.property('_id');
    //     expect(user.role).to.be.eq("admin");
    // });
  });
  describe(`Test route: '/user/profile' [PUT]`, () => {
    it("should validate updation parameters", (done) => {
      requestBody = {
        walletAddress: "0xA0899ead09Fba22578408551d9023F04865aA1f9",
      };

      chai
        .request(server)
        .put("/v2-wallet-login/user/profile")
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
        .put("/v2-wallet-login/user/profile")
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq("User updated successfully");
          done();
        });
    });
  });

  describe(`Test route: '/user/admin/statistics' [GET]`, () => {
    it("should create a new collection", (done) => {
      requestBody = {
        name: "Armada",
        symbol: "JS",
        description:
          "This is test collection for an armada owner by the great Captain Jack Sparrow, Savy!?",
      };

      chai
        .request(server)
        .post("/collection/")
        .auth(JWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .field("name", requestBody.name)
        .field("symbol", requestBody.symbol)
        .field("description", requestBody.description)
        .attach("thumbnail", "test/stub1.txt")
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("collection");
          expect(res.body.message).to.be.eq("Collection created successfully!");
          collectionId = res.body.collection._id;
          done();
        });
    });

    it("should create another new collection", (done) => {
      requestBody = {
        name: "Temp Collection",
        symbol: "TMP",
        description:
          "This is test collection for an temporary owner by the great Captain Jack Sparrow, Savy!?",
      };

      chai
        .request(server)
        .post("/collection/")
        .auth(JWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .field("name", requestBody.name)
        .field("symbol", requestBody.symbol)
        .field("description", requestBody.description)
        .attach("thumbnail", "test/stub1.txt")
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("collection");
          expect(res.body.message).to.be.eq("Collection created successfully!");
          collectionId2 = res.body.collection._id;
          done();
        });
    });

    it("should fetch collection from DB and update contract Type", async () => {
      const collections = await collectionModel.find();
      console.log("COllections : ", collections[1]);

      await collectionModel.updateOne(
        { _id: collections[0]._id },
        { contractType: "721" }
      );
      await collectionModel.updateOne(
        { _id: collections[1]._id },
        { contractType: "1155" }
      );
      const collection = await collectionModel.findById(collections[1]._id);
      console.log("COllection : ", collection);
      expect(collection).to.have.property("_id");
      expect(collection).to.have.property("nftId");
      expect(collection.contractType).to.be.eq("1155");
    });

    it("should add 2 NFTs in created collection", (done) => {
      requestBody = {
        collectionId,
        data: [
          {
            title: "The Dutchman",
            type: "Rare",
            nftFormat: "png",
            nftURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dutchman.png",
            metadataURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dutchman.json",
            supplyType: "Single",
          },
          {
            title: "Temporary",
            type: "Rare",
            nftFormat: "png",
            nftURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/temp.png",
            metadataURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/temp.json",
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

    it("should add another NFT in created collection 2", (done) => {
      requestBody = {
        collectionId: collectionId2,
        data: [
          {
            title: "The Pirate",
            type: "Epic",
            nftFormat: "png",
            nftURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pirate.png",
            metadataURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/pirate.json",
          },
          {
            title: "Dummy",
            type: "Rare",
            nftFormat: "png",
            nftURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dummy.png",
            metadataURI:
              "https://scytalelabs.mypinata.cloud/ipfs/LmVTKRH5oJ6DfhNBSSFfgMxbG8KEy1Cy9ebXtzPwGMnPZa/dummy.json",
            supplyType: "Variable",
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

    it("should fetch collection from DB and save NFT Id(s)", async () => {
      const collection = await collectionModel.findById(collectionId);
      const collection2 = await collectionModel.findById(collectionId2);
      nftId = collection.nftId[0];
      nftId2 = collection2.nftId[0];
      nftId3 = collection.nftId[1];
      nftId4 = collection2.nftId[1];
      expect(collection).to.have.property("_id");
      expect(collection).to.have.property("nftId");
      expect(nftId).to.be.eq(collection.nftId[0]);
      expect(nftId2).to.be.eq(collection2.nftId[0]);
      expect(nftId3).to.be.eq(collection.nftId[1]);
      expect(nftId4).to.be.eq(collection2.nftId[1]);
    });

    it(`should put nft on fixed price sale `, (done) => {
      requestBody = {
        nftId,
        price: 100,
      };

      chai
        .request(server)
        .post("/marketplace/nft/sale")
        .send(requestBody)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq("NFT successfully put on sale");
          done();
        });
    });

    it(`should put Second nft on fixed price sale `, (done) => {
      requestBody = {
        nftId: nftId3,
        price: 100,
      };

      chai
        .request(server)
        .post("/marketplace/nft/sale")
        .send(requestBody)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq("NFT successfully put on sale");
          done();
        });
    });

    it(`should put nft on auction`, (done) => {
      requestBody = {
        nftId: nftId2,
        price: 50,
        startTime: Date.now() + 5000,
        endTime: Date.now() + 80000,
      };

      chai
        .request(server)
        .post("/auction/nft/auction")
        .send(requestBody)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq("NFT successfully put on auction");
          done();
        });
    });

    it(`should put another nft on auction`, (done) => {
      requestBody = {
        nftId: nftId4,
        price: 50,
        startTime: Date.now() + 5000,
        endTime: Date.now() + 80000,
      };

      chai
        .request(server)
        .post("/auction/nft/auction")
        .send(requestBody)
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq("NFT successfully put on auction");
          done();
        });
    });

    it("should signup new admin", (done) => {
      requestBody = {
        username: "Admin",
        email: "admin@gmail.com",
        password: "1234",
      };
      chai
        .request(server)
        .post("/user/admin/signup")
        .send(requestBody)
        .end((err, res) => {
          console.log(res);
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq("Admin Successfully Signed-up");
          done();
        });
    });

    it("should login existing admin", (done) => {
      requestBody = {
        email: "admin@gmail.com",
        password: "1234",
      };

      chai
        .request(server)
        .post("/user/admin/login")
        .send(requestBody)
        .end((err, res) => {
          console.log(res);
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body).to.have.property("token");
          expect(res.body.message).to.be.eq("Admin Successfully logged-in");
          tempJWT = res.body.token;
          done();
        });
    });

    it(`should buy the nft `, (done) => {
      requestBody = {
        nftId,
        // price: 100,
      };

      chai
        .request(server)
        .post("/marketplace/nft/buy")
        .send(requestBody)
        .auth(tempJWT, { type: "bearer" })
        .end((err, res) => {
          // console.log('Previous owner : ', user);
          // console.log('new owner : ', tempUser);
          // console.log(res)
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          // expect(res.body.nftNewOwner).to.be.eq(tempUser);
          expect(res.body.message).to.be.eq("NFT successfully bought");
          done();
        });
    });

    it(`should bid on nft id `, (done) => {
      MockDate.set(Date.now() + 5000);

      requestBody = {
        nftId: nftId2,
        bidAmount: 55,
        expiryTime: Date.now() + 50000,
      };

      chai
        .request(server)
        .post("/auction/nft/bid")
        .auth(tempJWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          console.log(res);
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body).to.have.property("bidId");

          expect(res.body.message).to.be.eq("Bid added successfully.");
          bidIdForAuction = res.body.bidId;
          done();
        });
    });

    it(`should accept the bid on nft put on auction`, (done) => {
      requestBody = {
        bidId: bidIdForAuction,
      };
      MockDate.set(Date.now() + 80000);
      chai
        .request(server)
        .post(`/auction/nft/acceptBid`)
        .auth(JWT, { type: "bearer" })
        .send(requestBody)
        .end((err, res) => {
          console.log("res : ", res.body);
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq("Bid accepted successfully.");
          done();
        });
    });

    it("should create the drop", (done) => {
      requestBody = {
        title: "Fancy Drop",
        image: "https://ipfs/pretty-uri",
        description:
          "This is a v special drop, created for one Mr Jack Sparrow",
        startTime: Date.now() + 5000,
        endTime: Date.now() + 86400000,
        saleType: "auction",
        dropType: "721",
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

    it("should create the drop", (done) => {
      requestBody = {
        title: "Simple Drop",
        image: "https://ipfs/pretty-uri",
        description:
          "This is a v special drop, created for one Mr Jack Sparrow",
        startTime: Date.now() + 5000,
        endTime: Date.now() + 86400000,
        saleType: "fixed-price",
        dropType: "1155",
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

    it("should get admin stats", (done) => {
      // requestBody = {
      // 	walletAddress: "0xA0899ead09Fba22578408551d9023F04865aA1f9",
      // 	username: "Jane Doe",
      // };

      chai
        .request(server)
        .get("/user/admin/statistics")
        .auth(JWT, { type: "bearer" })
        // .send(requestBody)
        .end((err, res) => {
          console.log("res : ", res.text);
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.data.TotalCollections721).to.be.eq(1);
          expect(res.body.data.TotalCollections1155).to.be.eq(1);
          expect(res.body.data.TotalNFTs721).to.be.eq(2);
          expect(res.body.data.TotalNFTs1155).to.be.eq(2);
          expect(res.body.data.TotalNFTsOnSale721).to.be.eq(1);
          expect(res.body.data.TotalNFTsOnSale1155).to.be.eq(1);
          expect(res.body.data.TotalNFTsSoldFixedPrice).to.be.eq(1);
          expect(res.body.data.TotalNFTsSoldAuction).to.be.eq(1);
          expect(res.body.data.TotalDropsFixedPrice).to.be.eq(1);
          expect(res.body.data.TotalDropsAuction).to.be.eq(1);

          done();
        });
    });
  });
});
