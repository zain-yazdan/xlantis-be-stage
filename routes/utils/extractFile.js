const extract = require('extract-zip')

async function extractFile (source, target) {
  console.log("extracting file .....");
  try {
    const data = await extract(source, { dir: target })
    return {
        success: true,
        message: "File extracted successfully."
    }
  } catch (err) {
    return {
        success: false,
        message: err
    }
  }
}

exports.extractFile = extractFile;