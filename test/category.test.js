const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require("mongoose");
const server = require("../app");
require("dotenv").config();
const jwtUtil = require("../utils/jwt");

const expect = chai.expect;
chai.use(chaiHttp);

const UserModel = require("../models/UserModel");
const CategoryModel = require("../models/CategoryModel");

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

let requestBody, JWT;

describe("Create a new super admin and login ", () => {

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
        JWT = res.body.token;
        done();
      });
  });
});

describe("Testing route /category/ [POST]", () => {
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
        .post("/category/")
        .auth(JWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .attach("image", "test/stub1.txt")
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("Name not found in request body.");
          done();
        });
    });

    it("should validate empty request body parameter", (done) => {
      requestBody = {
        name: ""
      };

      chai
        .request(server)
        .post("/category/")
        .auth(JWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .field("name", requestBody.name)
        .attach("image", "test/stub1.txt")
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("Name found empty in request body.");
          done();
        });
    });

    it("should validate that a image file is passed as request files parameter", (done) => {
      requestBody = {
        name: "Avatars",
      };

      chai
        .request(server)
        .post("/category/")
        .auth(JWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .field("name", requestBody.name)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("Image not found in request file.");
          done();
        });
    });

    // Positive case
    it("should create a new category", (done) => {
      requestBody = {
        name: "Avatars",
      };

      chai
        .request(server)
        .post("/category/")
        .auth(JWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .field("name", requestBody.name)
        .attach("image", "test/stub1.txt")

        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.message).to.be.eq("Category added successfully.");
          done();
        });
    });

    it("should create another new category", (done) => {
      requestBody = {
        name: "Land Plots",
      };

      chai
        .request(server)
        .post("/category/")
        .auth(JWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .field("name", requestBody.name)
        .attach("image", "test/stub2.txt")

        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.message).to.be.eq("Category added successfully.");
          done();
        });
    });
});

describe("Testing route /category/:categoryName [PUT]", () => {
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
        .put("/category/randomName")
        .auth(JWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("No category found against provided category name.");
          done();
        });
    });

    // Positive case
    it("should update the name of existing category", (done) => {
      requestBody = {
        name: "Meta Racers",
      };

      chai
        .request(server)
        .put("/category/Avatars")
        .auth(JWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .field("name", requestBody.name)

        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq("Category updated successfully.");
          done();
        });
    });

    
    //NEGATICE CASE
    it("should check if the name has updated or not", (done) => {
      chai
        .request(server)
        .put("/category/Avatars")
        .auth(JWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")

        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("No category found against provided category name.");
          done();
        });
    });


    //POSITIVE CASE
    it("should update the image of existing category", (done) => {
      chai
        .request(server)
        .put("/category/Meta Racers")
        .auth(JWT, { type: "bearer" })
        .field("Content-Type", "multipart/form-data")
        .attach("image", "test/stub3.txt")

        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body.message).to.be.eq("Category updated successfully.");
          done();
        });
    });
});

describe("Testing route /category/is-available [GET]", () => {
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

  it("should validate missing request query parameter", (done) => {
    
      chai
        .request(server)
        .get("/category/is-available")
        .auth(JWT, { type: "bearer" })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("Category Name not found in request query.");
          done();
        });
    });

    it("should validate empty request query parameter", (done) => {
    
      chai
        .request(server)
        .get("/category/is-available")
        .auth(JWT, { type: "bearer" })
        .query({
          categoryName: ""
        })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.eq(false);
          expect(res.body.message).to.be.eq("Category Name found empty in request query.");
          done();
        });
    });

    // Positive case
    it("should check if category already exists", (done) => {
      chai
        .request(server)
        .get("/category/is-available")
        .auth(JWT, { type: "bearer" })
        .query({
          categoryName: "Meta Racers"
        })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body).to.have.property("isAvailable");
          expect(res.body.isAvailable).to.be.eq(false);
          expect(res.body.message).to.be.eq("Category already exists.");
          done();
        });
    });

    it("should check if category already exists or not", (done) => {
      chai
        .request(server)
        .get("/category/is-available")
        .auth(JWT, { type: "bearer" })
        .query({
          categoryName: "Hello World"
        })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body.success).to.be.eq(true);
          expect(res.body).to.have.property("isAvailable");
          expect(res.body.isAvailable).to.be.eq(true);
          expect(res.body.message).to.be.eq("Category does not exists.");
          done();
        });
    });
});


describe(`Test route: '/category/' [GET]`, () => {
  //POSITIVE CASE
  it("should return all the categories from the database", (done) => {
    chai
      .request(server)
      .get(`/category/`)
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        console.log(res);
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("categories");
        expect(res.body.categories.length).to.be.eq(2);

        expect(res.body.categories[0]).to.have.property("_id");
        expect(res.body.categories[0]).to.have.property("name");
        expect(res.body.categories[0]).to.have.property("imageUrl");
        expect(res.body.categories[0]).to.have.property("createdAt");
        expect(res.body.categories[0]).to.have.property("updatedAt");

        expect(res.body.categories[1]).to.have.property("_id");
        expect(res.body.categories[1]).to.have.property("name");
        expect(res.body.categories[1]).to.have.property("imageUrl");
        expect(res.body.categories[1]).to.have.property("createdAt");
        expect(res.body.categories[1]).to.have.property("updatedAt");
        done();
      });
  });
});
