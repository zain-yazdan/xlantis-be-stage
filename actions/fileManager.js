const fs = require("fs");
const multer = require("multer");

// Multer configuration (for map point)

const storage1 = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads");
  },
  filename: (req, file, cb) => {
    // console.log("File name : " + Date.now() + file.originalname);
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload1 = multer({
  storage: storage1,
  limits: { fileSize: 1024 * 1024 * 10 }, // maximum file size allowed is 10 MB
  // fileFilter: imageFileFilter
});

module.exports.uploadDocument = upload1;

async function DeleteFile(_path) {
  // console.log("_path : " + _path);

  fs.unlink(_path, (err) => {
    if (err) console.log("err: ", err);
    console.log(`file deleted @ path: ${_path}`);
  });
}
module.exports.DeleteFile = DeleteFile;
