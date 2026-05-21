const nodemailer = require("nodemailer");
const dns = require("dns").promises;

const getGmailIPv4Host = async () => {
  const addresses = await dns.resolve4("smtp.gmail.com");

  if (!addresses || addresses.length === 0) {
    throw new Error("Could not resolve Gmail SMTP IPv4 address");
  }

  return addresses[0];
};

const sendEmail = async (options = {}) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error("❌ Email Error: EMAIL_USER or EMAIL_PASS missing");
      return false;
    }

    const to = options.to || options.email;

    if (!to) {
      console.error("❌ Email Error: receiver email missing");
      return false;
    }

    const subject = options.subject || "Wearlance Notification";
    const message = options.message || options.text || "Wearlance notification";
    const html = options.html || `<p>${message}</p>`;

    const smtpIPv4Host = await getGmailIPv4Host();

    console.log("📧 Gmail SMTP IPv4 selected:", smtpIPv4Host);

    const transporter = nodemailer.createTransport({
      host: smtpIPv4Host,
      port: 587,
      secure: false,
      requireTLS: true,

      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },

      tls: {
        servername: "smtp.gmail.com",
        rejectUnauthorized: true,
      },

      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 45000,
    });

    await transporter.verify();

    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || "Wearlance"}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: message,
      html,
    });

    console.log("✅ Email sent successfully:", info.messageId);
    return true;
  } catch (error) {
    console.error("❌ Email Error:", error.message);
    return false;
  }
};

module.exports = sendEmail;