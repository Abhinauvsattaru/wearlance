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

    const subject = options.subject || "Wearlance OTP";
    const message = options.message || options.text || "Wearlance notification";
    const html = options.html || `<p>${message}</p>`;

    const payload = {
      secret,
      to,
      subject,
      text: message,
      html,
      fromName: process.env.EMAIL_FROM_NAME || "Wearlance",
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

    console.log("📧 Gmail Apps Script status:", response.status);
    console.log("📧 Gmail Apps Script response:", rawText.slice(0, 500));

    let data = null;

    try {
      data = JSON.parse(rawText);
    } catch (error) {
      data = null;
    }

    if (response.ok && (!data || data.success !== false)) {
      console.log("✅ OTP email request accepted by Gmail Apps Script");
      return true;
    }

    if (data && data.success === true) {
      console.log("✅ OTP email sent from Gmail Apps Script");
      return true;
    }

    console.error(
      "❌ Email Error:",
      data?.message || data?.error || rawText || "Google Apps Script mail request failed"
    );

    return false;
  } catch (error) {
    console.error("❌ Email Error:", error.message);
    return false;
  }
};

module.exports = sendEmail;
