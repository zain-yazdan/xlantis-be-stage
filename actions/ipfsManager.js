const IpfsHttpClient = require("ipfs-http-client");
const { globSource } = IpfsHttpClient;
const ipfs = IpfsHttpClient({
  host: "ipfs.infura.io",
  port: 5001,
  protocol: "https",
});

async function uploadFile(_filePath) {
  console.log("Aya : " + _filePath);

  // const file = await ipfs.add(globSource('..\\public\\images\\1602020133562-a.png', { recursive: true }))
  // console.log("file : ", file)
  // return file;

  ipfs
    .add(
      globSource("..\\public\\images\\1602020133562-a.png", { recursive: true })
    )
    .then((result) => {
      console.log("hash : ", result);
      return result;
    })
    .catch((err) => {
      console.log("errorr : ", err);
      return err;
    });
}

module.exports.uploadFile = uploadFile;

// QmTKnyMxrXhJwc2UqceLM3XCjiiscPd2WC9oifjWMiiDae
//https://bafybeickcizgkr4rbjzcorpbpjujqvm4cpagnh6nwqacttzavdsj6jrea4.ipfs.infura-ipfs.io/
