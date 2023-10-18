const chai = require("chai");
const chaiHttp = require("chai-http");
const mocha = require("mocha");
const mongoose = require("mongoose");
const server = require("../app");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const expect = chai.expect;
chai.use(chaiHttp);

if (process.env.NODE_MODE != "test") {
  throw 'To run the tests, NODE_MODE should be set to "test" in environment variables';
}
const UserModel = require("../models/UserModel");

let JWT, tempJWT, requestBody, existingFiles;
const directory = "public/uploads";

before(async () => {
  const CONNECTION_STRING = process.env.DATABASE_TESTING_URL;

  const isLocalhost = CONNECTION_STRING.startsWith("mongodb://localhost:27017");
  if (!isLocalhost) throw "To run the tests, connect to local mongo database";

  const connect = await mongoose.connect(CONNECTION_STRING);
  console.log("Connected to the MongoDB server");

  await connect.connection.db.dropDatabase();
  console.log("Connected database dropped");

  existingFiles = fs.readdirSync(directory);
  // console.log({existingFiles});
});

after(async () => {
  const files = fs.readdirSync(directory);

  const removeFiles = files.filter((file) => {
    return existingFiles.indexOf(file) === -1;
  });
  // console.log({removeFiles});

  for (const file of removeFiles) {
    fs.unlink(path.join(directory, file), (err) => {
      if (err) throw err;
    });
  }
  // console.log(`Files created in directory ${directory} safely removed`);
});

describe("\nCreate a new user and login that user", () => {
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
        tempJWT = res.body.token;
        done();
      });
  });
});
describe("\nTesting route: /admin/template (POST)", () => {
  it("should validate required attributes are passed as request body parameters", (done) => {
    requestBody = {
      data: [
        {
          key: "Model",
          type: "String",
        },
        {
          key: "Color",
          type: "String",
        },
      ],
    };

    chai
      .request(server)
      .post("/nft-properties/admin/template")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq(
          "isDefault not found in request body!"
        );
        done();
      });
  });

  it("should validate required attributes are not passed empty in request body", (done) => {
    requestBody = {
      name: "",
      isDefault: true,
      data: [
        {
          key: "Model",
          type: "String",
        },
        {
          key: "Color",
          type: "String",
        },
      ],
    };

    chai
      .request(server)
      .post("/nft-properties/admin/template")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("name was empty in request body!");
        done();
      });
  });

  it("should validate is Default must be boolean ", (done) => {
    requestBody = {
      name: "Cars",
      isDefault: "true",
      data: [
        {
          key: "Model",
          type: "String",
        },
        {
          key: "Color",
          type: "String",
        },
      ],
    };

    chai
      .request(server)
      .post("/nft-properties/admin/template")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.success).to.be.eq(false);
        expect(res.body.message).to.be.eq("isDefault value must be boolean.");
        done();
      });
  });

  //POSITIVE CASE
  it("should create the template", (done) => {
    requestBody = {
      name: "Cars",
      isDefault: true,
      data: [
        {
          key: "Model",
          type: "String",
        },
        {
          key: "Color",
          type: "String",
        },
        {
          key: "Company",
          type: "String",
        },
      ],
    };

    chai
      .request(server)
      .post("/nft-properties/admin/template")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("Template created successfully.");
        done();
      });
  });

  it("should create another template", (done) => {
    requestBody = {
      name: "Bikes",
      isDefault: false,
      data: [
        {
          key: "Model",
          type: "String",
        },
        {
          key: "Color",
          type: "String",
        },
        {
          key: "Company",
          type: "String",
        },
      ],
    };

    chai
      .request(server)
      .post("/nft-properties/admin/template")
      .auth(JWT, { type: "bearer" })
      .send(requestBody)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body.message).to.be.eq("Template created successfully.");
        done();
      });
  });
});

// describe('\nTesting route: /nft-properties/ (POST)', () => {
//     it('should validate required attributes are passed as request body parameters', (done)=>{
//         requestBody = {
//            data : [{
//                 key: "Model",
//                 type: "String"
//            },{
//                 key: "Color",
//                 type: "String"
//            }]
//         }

//         chai.request(server)
//         .post('/nft-properties/')
//         .auth(tempJWT, { type: 'bearer' })
//         .send(requestBody)
//         .end((err, res) => {
//             expect(res).to.have.status(400);
//             expect(res.body.success).to.be.eq(false);
//             expect(res.body.message).to.be.eq('name not found in request body');
//             done();
//         });
//     });

//     it('should validate required attributes are not passed empty in request body', (done)=>{
//         requestBody = {
//             name: "",
//             data : [{
//                 key: "Model",
//                 type: "String"
//            },{
//                 key: "Color",
//                 type: "String"
//            }]
//         }

//         chai.request(server)
//         .post('/nft-properties/')
//         .auth(tempJWT, { type: 'bearer' })
//         .send(requestBody)
//         .end((err, res) => {
//             expect(res).to.have.status(400);
//             expect(res.body.success).to.be.eq(false);
//             expect(res.body.message).to.be.eq('name was empty in request body');
//             done();
//         });
//     });

//     // it('should validate is Default must be boolean ', (done)=>{
//     //     requestBody = {
//     //         name: "Cars",
//     //         isDefault: "true",
//     //         data : [{
//     //             key: "Model",
//     //             type: "String"
//     //        },{
//     //             key: "Color",
//     //             type: "String"
//     //        }]
//     //     }

//     //     chai.request(server)
//     //     .post('/nft-properties/admin/template')
//     //     .auth(JWT, { type: 'bearer' })
//     //     .send(requestBody)
//     //     .end((err, res) => {
//     //         expect(res).to.have.status(400);
//     //         expect(res.body.success).to.be.eq(false);
//     //         expect(res.body.message).to.be.eq('isDefault value must be boolean.');
//     //         done();
//     //     });
//     // });

//     //POSITIVE CASE
//     it('should create the template', (done)=>{
//         requestBody = {
//             name: "Ships",
//             data : [{
//                 key: "Model",
//                 type: "String"
//            },{
//                 key: "Color",
//                 type: "String"
//            },{
//                 key: "Company",
//                 type: "String"
//            }]
//         }

//         chai.request(server)
//         .post('/nft-properties/')
//         .auth(tempJWT, { type: 'bearer' })
//         .send(requestBody)
//         .end((err, res) => {
//             expect(res).to.have.status(200);
//             expect(res.body.success).to.be.eq(true);
//             expect(res.body.message).to.be.eq('Template created successfully.');
//             done();
//         });
//     });

//     it('should create another template', (done)=>{
//         requestBody = {
//             name: "Mobiles",
//             isDefault: false,
//             data : [{
//                 key: "Model",
//                 type: "String"
//            },{
//                 key: "Color",
//                 type: "String"
//            },{
//                 key: "Company",
//                 type: "String"
//            }]
//         }

//         chai.request(server)
//         .post('/nft-properties/')
//         .auth(tempJWT, { type: 'bearer' })
//         .send(requestBody)
//         .end((err, res) => {
//             expect(res).to.have.status(200);
//             expect(res.body.success).to.be.eq(true);
//             expect(res.body.message).to.be.eq('Template created successfully.');
//             done();
//         });
//     });
// });

describe("\nTesting route: /admin/default (GET)", () => {
  it("should get the default template of the current admin", (done) => {
    chai
      .request(server)
      .get("/nft-properties/admin/default")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("defaultTemplate");
        expect(res.body.defaultTemplate.name).to.be.eq("Cars");
        expect(res.body.defaultTemplate.isDefault).to.be.eq(true);
        done();
      });
  });
});

describe("\nTesting route: /admin (GET)", () => {
  it("should get all templates of the current admin", (done) => {
    chai
      .request(server)
      .get("/nft-properties/admin")
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("templates");
        expect(res.body.templates.length).to.be.eq(2);
        done();
      });
  });
});

describe("\nTesting route: /:userType (GET)", () => {
  it("should get all templates by user type (admin)", (done) => {
    chai
      .request(server)
      .get(`/nft-properties/admin`)
      .auth(JWT, { type: "bearer" })
      .end((err, res) => {
        console.log(res);
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.eq(true);
        expect(res.body).to.have.property("templates");
        expect(res.body.templates.length).to.be.eq(2);
        done();
      });
  });

  // it('should get all templates by user type (super-admin)', (done)=>{

  //     chai.request(server)
  //     .get(`/nft-properties/super-admin`)
  //     .auth(JWT, { type: 'bearer' })
  //     .end((err, res) => {
  //         console.log(res)
  //         expect(res).to.have.status(200);
  //         expect(res.body.success).to.be.eq(true);
  //         expect(res.body).to.have.property("templates");
  //         expect(res.body.templates.length).to.be.eq(2);
  //         done();
  //     });
  // });
});

// describe('\nTesting route: nft-properties/ (GET)', () => {
//     it('should get all templates in the database', (done)=>{

//         chai.request(server)
//         .get(`/nft-properties/`)
//         .auth(JWT, { type: 'bearer' })
//         .end((err, res) => {
//             console.log(res)
//             expect(res).to.have.status(200);
//             expect(res.body.success).to.be.eq(true);
//             expect(res.body).to.have.property("templates");
//             expect(res.body.templates.length).to.be.eq(4);
//             done();
//         });
//     });
// });

// describe('\nTesting route: nft-properties/:start/:end (GET)', () => {
//     it('should get all templates in the database with pagination', (done)=>{

//         chai.request(server)
//         .get(`/nft-properties/0/1`)
//         .auth(JWT, { type: 'bearer' })
//         .end((err, res) => {
//             console.log(res)
//             expect(res).to.have.status(200);
//             expect(res.body.success).to.be.eq(true);
//             expect(res.body).to.have.property("templates");
//             expect(res.body.templates.length).to.be.eq(1);
//             done();
//         });
//     });
// });
