const fs = require('fs');
const path = require('path'); 

async function listDir(dirPath) {
  try {
    const dirName = path.join(__dirname, dirPath);
    const file = await fs.promises.readdir(dirPath);
    let jsons = []
    let files = [] 
    for (let i = 0; i < file.length; i++) {
        const filename = file[i];
        console.log(filename);
        if (!filename.toLowerCase().endsWith(".json"))
            files.push(file[i]);
        else
            jsons.push(file[i]);
    }

    return {
        success: true,
        files: files,
        json: jsons
    }

  } catch (err) {
    console.error('Error occurred while reading directory!', err);
    return {
        success: false,
        err: err,
    }
  }
}

function checkFileOccourenceInArray(element, filesArray, i = 0){

    for (let j = i; j < filesArray.length; j++) 
        if(element === path.parse(filesArray[j]).name)
            return true;
    
    return false;

}


exports.listDir = listDir;
exports.checkFileOccourenceInArray = checkFileOccourenceInArray

// const { readdir, readFile } = require("fs");
// const path = require('path'); 

// async function readJSONs(){

//     const dirName = path.join(__dirname, "../../public/uploads/nfts");
//     console.log(dirName);
//     const data = readdir(dirName, (err, fileList))// => {
//     console.log(data);

//     //   if (err) {
//     //     console.error(err);
//     //     return {
//     //         success: false,
//     //         message: err
//     //     }
//     //   }
//     //   else{
//     //         console.log(fileList);
//     //       return fileList;
//     //   }
    
//     //   for (let i = 0; i < fileList.length; i++) {
//     //     const filename = fileList[i];

//     //     if (!filename.toLowerCase().endsWith(".json")) continue;
    
//     //     const fullFilename = path.join(dirName, filename);
//     //     readFile(fullFilename, { encoding: "utf-8" },
//     //       (err, data) => {
//     //         try {
//     //           const fileContent = JSON.parse(data);
//     //             return {
//     //                 succesS: 
//     //             }

//     //         } catch (err) {
//     //             return {
//     //                 success: false,
//     //                 message: err
//     //             }
//     //         }
//     //       });
//     //   }
//     });
// }
// // readJSONs();
// exports.readJSONs = readJSONs;