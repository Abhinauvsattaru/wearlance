const https = require("https");

const postJson = (url, payload) => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const parsedUrl = new URL(url);

    const request = https.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 30000,
      },
      (response) => {
        let data = "";

        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          try {
            const json = JSON.parse(data || "{}");
            resolve({
              statusCode: response.statusCode,
              data: json,
            });
          } catch (error) {
            reject(new Error(`Invalid mail API response: ${data}`));
          }
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Google Mail Web App request timeout"));
    });

    request.on("error", reject);
    request.write(body);
    request.end();
  });
};

const stripHtml = (html = "") => {
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
};

const sendEmail = async (options = {}) => {
  try {
    const webAppUrl = process.env.GOOGLE_MAIL_WEBAPP_URL;
    const secret = process.env.GOOGLE_MAIL_SECRET;

    if (!webAppUrl || !secret) {
      console.error("❌ Email Error: GOOGLE_MAIL_WEBAPP_URL or GOOGLE_MAIL_SECRET missing");
      return false;
    }

    const to = options.to || options.email;

    if (!to) {
      console.error("❌ Email Error: receiver email missing");
      return false;
    }

    const subject = options.subject || "Wearlance Notification";
    const html = options.html || "";
    const text = options.message || options.text || stripHtml(html) || "Wearlance notification";

    const result = await postJson(webAppUrl, {
      secret,
      to,
      subject,
      html,
      text,
      fromName: process.env.EMAIL_FROM_NAME || "Wearlance",
    });

    if (result.statusCode < 200 || result.statusCode >= 300 || !result.data.success) {
      console.error("❌ Email Error:", result.data.message || `Mail API failed with ${result.statusCode}`);
      return false;
    }

    console.log("✅ Email sent successfully using Google Apps Script:", result.data.message || "OK");
    return true;
  } catch (error) {
    console.error("❌ Email Error:", error.message);
    return false;
  }
};

module.exports = sendEmail;
