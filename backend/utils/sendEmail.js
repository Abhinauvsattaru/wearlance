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
    const message = options.message || options.text || "Wearlance notification";

    const html =
      options.html ||
      `<div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Wearlance</h2>
        <p>${message}</p>
      </div>`;

    const attachments = Array.isArray(options.attachments)
      ? options.attachments
          .filter((attachment) => attachment && attachment.content && attachment.filename)
          .map((attachment) => ({
            filename: String(attachment.filename).slice(0, 120),
            mimeType: attachment.mimeType || "application/octet-stream",
            content: attachment.content,
          }))
      : [];

    const payload = {
      secret,
      to,
      subject,
      text: message,
      html,
      fromName: process.env.EMAIL_FROM_NAME || "Wearlance",
      attachments,
    };

    const response = await fetch(webAppUrl, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();

    console.log("📧 Gmail Apps Script HTTP status:", response.status);
    console.log("📧 Gmail Apps Script response:", rawText.slice(0, 700));

    return true;
  } catch (error) {
    console.error("❌ Email Error:", error.message);
    return false;
  }
};

module.exports = sendEmail;
