const nodemailer = require("nodemailer");

const createTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    family: 4,

    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },

    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
  });
};

const sendEmail = async (options = {}) => {
  try {
    const transporter = createTransporter();

    const to = options.to || options.email;
    const subject = options.subject || "Wearlance Notification";
    const html = options.html || "";
    const text = options.text || "";

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error("❌ Email Error: EMAIL_USER or EMAIL_PASS missing");
      return false;
    }

    if (!to) {
      console.error("❌ Email Error: receiver email missing");
      return false;
    }

    const info = await transporter.sendMail({
      from: `"Wearlance" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: text || "Wearlance notification",
      html: html || `<p>${text || "Wearlance notification"}</p>`,
    });

    console.log("✅ Email sent successfully:", info.messageId);
    return true;
  } catch (error) {
    console.error("❌ Email Error:", error.message);
    return false;
  }
};

module.exports = sendEmail;