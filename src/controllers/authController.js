const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { sendMail, formatOTPEmail } = require("../services/mailer");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

function genOTP(len = 6) {
  const digits = "0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += digits[Math.floor(Math.random() * 10)];
  return out;
}

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Thiếu name/email/password" });
    }

    const emailExisted = await User.findOne({ email }).lean();
    if (emailExisted) {
      return res.status(409).json({ message: "Email đã đăng ký." });
    }

    const passHash = await bcrypt.hash(password, 10);
    const verifyCode = genOTP(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Accept only 'customer' or 'owner' from client. Default to customer.
    const chosenRole = role === "owner" ? "owner" : "customer";

    const user = await User.create({
      name,
      email,
      phone: phone || undefined,
      passHash,
      roles: [chosenRole],
      status: "active",
      emailVerified: false,
      verificationOTP: verifyCode,
      verificationExpiresAt: expiresAt,
      otpLastSentAt: new Date(),
    });

    try {
      const tpl = formatOTPEmail(verifyCode, "verify");
      await sendMail({ to: user.email, ...tpl });
    } catch (mailErr) {
      console.error("send verify mail error:", mailErr.message);
    }

    return res.json({
      message:
        "Đăng ký thành công. Vui lòng kiểm tra email để nhập mã xác minh.",
      next: "verify_email",
      email: user.email,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: "Email đã đăng ký." });
    }
    console.error("register error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email }).lean();
    if (!user) {
      return res.status(401).json({ message: "Sai email hoặc mật khẩu." });
    }
    const ok = await bcrypt.compare(password, user.passHash);
    if (!ok) {
      return res.status(401).json({ message: "Sai email hoặc mật khẩu." });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: "Email chưa được xác minh. Vui lòng kiểm tra email.",
      });
    }

    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email, roles: user.roles },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userForClient = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      phone: user.phone,
      role:
        Array.isArray(user.roles) && user.roles.length > 0
          ? user.roles[0]
          : "customer",
    };

    // 2. Trả về cả token và user
    return res.json({
      message: "Đăng nhập thành công",
      token: token,
      user: userForClient, // <--- THÊM DÒNG NÀY
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code)
      return res.status(400).json({ message: "Thiếu email/code" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    if (user.emailVerified) return res.json({ message: "Email đã xác minh" });

    const now = new Date();
    if (
      !user.verificationOTP ||
      !user.verificationExpiresAt ||
      user.verificationExpiresAt < now
    ) {
      return res
        .status(400)
        .json({ message: "Mã xác minh đã hết hạn, vui lòng yêu cầu mã mới" });
    }
    if (String(user.verificationOTP) !== String(code)) {
      return res.status(400).json({ message: "Mã xác minh không đúng" });
    }

    user.emailVerified = true;
    user.verificationOTP = undefined;
    user.verificationExpiresAt = undefined;
    await user.save();

    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email, roles: user.roles },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userForClient = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      phone: user.phone,
      role:
        Array.isArray(user.roles) && user.roles.length
          ? user.roles[0]
          : "customer",
    };

    return res.json({
      message: "Xác minh thành công",
      token,
      user: userForClient,
    });
  } catch (err) {
    console.error("verifyEmail error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

exports.resendVerifyCode = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: "Thiếu email" });
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    if (user.emailVerified) return res.json({ message: "Email đã xác minh" });

    const now = Date.now();
    if (user.otpLastSentAt && now - user.otpLastSentAt.getTime() < 60 * 1000) {
      return res.status(429).json({ message: "Vui lòng thử lại sau ít phút" });
    }

    const code = genOTP(6);
    user.verificationOTP = code;
    user.verificationExpiresAt = new Date(now + 10 * 60 * 1000);
    user.otpLastSentAt = new Date(now);
    await user.save();

    try {
      const tpl = formatOTPEmail(code, "verify");
      await sendMail({ to: user.email, ...tpl });
    } catch (mailErr) {
      console.error("resend verify mail error:", mailErr.message);
    }
    return res.json({ message: "Đã gửi lại mã xác minh" });
  } catch (err) {
    console.error("resendVerifyCode error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: "Thiếu email" });
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(200)
        .json({ message: "Nếu email tồn tại, mã OTP sẽ được gửi" });

    const now = Date.now();
    if (user.otpLastSentAt && now - user.otpLastSentAt.getTime() < 60 * 1000) {
      return res.status(429).json({ message: "Vui lòng thử lại sau ít phút" });
    }

    const code = genOTP(6);
    user.resetOTP = code;
    user.resetExpiresAt = new Date(now + 10 * 60 * 1000);
    user.otpLastSentAt = new Date(now);
    await user.save();

    try {
      const tpl = formatOTPEmail(code, "reset");
      await sendMail({ to: user.email, ...tpl });
    } catch (mailErr) {
      console.error("forgot mail error:", mailErr.message);
    }

    return res.json({ message: "Nếu email tồn tại, mã OTP sẽ được gửi" });
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword)
      return res.status(400).json({ message: "Thiếu email/code/newPassword" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });

    const now = new Date();
    if (!user.resetOTP || !user.resetExpiresAt || user.resetExpiresAt < now)
      return res.status(400).json({ message: "Mã OTP đã hết hạn" });
    if (String(user.resetOTP) !== String(code))
      return res.status(400).json({ message: "Mã OTP không đúng" });

    user.passHash = await bcrypt.hash(newPassword, 10);
    user.resetOTP = undefined;
    user.resetExpiresAt = undefined;
    await user.save();

    return res.json({ message: "Đặt lại mật khẩu thành công" });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

// Change password for authenticated user
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword)
      return res
        .status(400)
        .json({ message: "Thiếu currentPassword hoặc newPassword" });

    const userId = req.user && req.user.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });

    const ok = await require("bcrypt").compare(currentPassword, user.passHash);
    if (!ok)
      return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });

    user.passHash = await require("bcrypt").hash(newPassword, 10);
    await user.save();
    return res.json({ message: "Đổi mật khẩu thành công" });
  } catch (err) {
    console.error("changePassword error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};
