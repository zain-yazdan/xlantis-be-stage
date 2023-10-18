require("dotenv").config();

var whitelist = JSON.parse(process.env.CORS_ALLOWED);
// console.log('WHITELIST: ', whitelist);

const corsOptions = {
  origin: (origin, callback) => {
    // console.log('ORIGIN: ', origin);
    // console.log('whitelist: ', whitelist);
    // console.log('last element in whitelist: ', whitelist[whitelist.length - 1]);

    const result = whitelist.indexOf(origin);
    // console.log('CORS matching Result: ', result);
    callback(null, true);
    return;
    if (result != -1) {
      callback(null, true);
    } else {
      callback(
        new Error("CORS error: origin of request not found in whitelist")
      );
    }
  },
  methods: ["GET", "PUT", "POST", "DELETE", "PATCH"],
  optionsSuccessStatus: 200,
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
};

module.exports = corsOptions;
