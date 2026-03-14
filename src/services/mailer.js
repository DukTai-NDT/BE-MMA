const nodemailer = require("nodemailer");

const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM } =
  process.env;

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: String(SMTP_SECURE || "false").toLowerCase() === "true",
      auth:
        SMTP_USER && SMTP_PASS
          ? { user: SMTP_USER, pass: SMTP_PASS }
          : undefined,
    });
  }
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const tx = getTransporter();
  const from = SMTP_FROM || SMTP_USER;
  if (!from) throw new Error("SMTP_FROM or SMTP_USER must be set in .env");
  return tx.sendMail({ from, to, subject, text, html });
}

function formatOTPEmail(code, purpose) {
  const title = purpose === "verify" ? "Xác minh email" : "Đặt lại mật khẩu";
  const intro =
    purpose === "verify"
      ? "Cảm ơn bạn đã đăng ký. Dưới đây là mã xác minh email của bạn:"
      : "Bạn vừa yêu cầu đặt lại mật khẩu. Đây là mã OTP của bạn:";
  return {
    subject: `[${title}] Mã OTP của bạn`,
    text: `${intro} ${code}. Mã sẽ hết hạn sau 10 phút.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
        <h2>${title}</h2>
        <p>${intro}</p>
        <p style="font-size:22px;font-weight:bold;letter-spacing:4px">${code}</p>
        <p>Mã sẽ hết hạn sau <b>10 phút</b>. Nếu không phải bạn thực hiện, hãy bỏ qua email này.</p>
      </div>
    `,
  };
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: String(SMTP_SECURE || "false").toLowerCase() === "true",
      auth:
        SMTP_USER && SMTP_PASS
          ? { user: SMTP_USER, pass: SMTP_PASS }
          : undefined,
      tls: {
        rejectUnauthorized: false, // ✅ Thêm dòng này để bỏ qua lỗi SSL khi chạy local
      },
    });
  }
  return transporter;
}

module.exports = { sendMail, formatOTPEmail, getTransporter };
