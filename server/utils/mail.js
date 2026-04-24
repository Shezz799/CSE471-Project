const nodemailer = require("nodemailer");

let transporterPromise;

async function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return null;
  }
  if (!transporterPromise) {
    transporterPromise = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
      auth: { user, pass },
    });
  }
  return transporterPromise;
}

/**
 * Sends email when SMTP is configured; otherwise logs to console.
 */
async function sendMail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || "noreply@localhost";
  const transport = await getTransporter();
  if (!transport) {
    console.log("[mail:skipped — set SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM]", {
      to,
      subject,
      textPreview: (text || "").slice(0, 200),
    });
    return { skipped: true };
  }
  await transport.sendMail({
    from,
    to,
    subject,
    text: text || "",
    html: html || undefined,
  });
  return { sent: true };
}

module.exports = { sendMail };
