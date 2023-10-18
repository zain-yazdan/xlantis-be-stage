var aes256 = require('aes256');
require("dotenv").config();

const cipher = aes256.createCipher(process.env.ENCRYPTION_KEY);

function decrypt(encryptedText) {
    var decryptedPlainText = cipher.decrypt(encryptedText);
    return decryptedPlainText;
}

module.exports = {
  decrypt
}