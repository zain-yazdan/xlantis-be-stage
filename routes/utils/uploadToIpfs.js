require("dotenv").config();
const path = require("path");
const axios = require('axios');
const pinataSDK = require('@pinata/sdk');
const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_API_SECRET);
const JWT = process.env.PINATA_API_JWT;
const FormData = require('form-data');
const fs = require('fs');

async function uploadMetadataToIpfs(metadata) {
    try {
        const result = await pinata.pinJSONToIPFS(metadata);
        return {
            success: true,
            IpfsData: result,
        };
    } catch (error) {
        return {
            success: false,
            err: error
        }
    }
}

async function uploadToIpfs(source, filename) {
    try {
        const formData = new FormData();
        const file = fs.createReadStream(source);
        formData.append('file', file);

        const metadata = JSON.stringify({
            name: filename,
        });

        formData.append('pinataMetadata', metadata);
        const options = JSON.stringify({
            cidVersion: 0,
        })
        formData.append('pinataOptions', options);
        const pinataResponse = await axios.post(process.env.PINATA_API_URL, formData, {
            maxBodyLength: "Infinity",
            headers: {
                'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
                Authorization: JWT
            }
        });
        return {
            success: true,
            message: "File uploaded successfully",
            IpfsData: pinataResponse.data,
        };

    } catch (error) {
        console.log("error (try-catch) : " + error);

        return {
            success: false,
            err: error
        };
    }
}

exports.uploadToIpfs = uploadToIpfs;
exports.uploadMetadataToIpfs = uploadMetadataToIpfs;