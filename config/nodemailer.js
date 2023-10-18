const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = () =>
  nodemailer.createTransport({
    // service: 'gmail',
    host: "smtp.sendgrid.net",
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: "apikey",
      pass: process.env.SENDGRID_API_KEY,
    },
  });

module.exports = transporter;
