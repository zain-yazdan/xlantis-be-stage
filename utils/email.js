const nodemailer = require("nodemailer");
require("dotenv").config();

async function sendEmail(to, subject, html, text) {
  console.log("sending email");

  try {
    const transporter = nodemailer.createTransport({
      // service: 'gmail',
      host: process.env.NODEMAILER_HOST,
      port: 465,
      secure: true,
      auth: {
        user: process.env.NODEMAILER_USER,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const mailOptions = {
      subject: subject,
      from: process.env.NODEMAILER_USER,
      to: to,
      text: text,
      html: html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Info: %s", info.envelope);
    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.log("(Try-Catch): " + error);
  }
}

exports.sendEmail = sendEmail;
