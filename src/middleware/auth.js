const jwt = require("jsonwebtoken");
const { User } = require("../models");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

/**
 * Middleware kiểm tra JWT token.
 * Nếu hợp lệ, gắn thông tin user (payload) vào req.user.
 */
exports.checkAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ message: "Authorization header missing." });
    }

    const token = authHeader.split(" ")[1]; // "Bearer <token>"
    if (!token) {
      return res.status(401).json({ message: "Token missing." });
    }

    const payload = jwt.verify(token, JWT_SECRET); // Gắn payload (chứa { sub, email, roles }) vào request

    req.user = payload;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired." });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token." });
    }
    console.error("checkAuth error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

/**
 * Middleware kiểm tra vai trò (role) của user.
 * Dùng *sau* checkAuth.
 * @param {string[]} allowedRoles - Mảng các role được phép, vd: ['admin'], ['owner']
 */
exports.checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập." });
    }

    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập." });
    }
    next();
  };
};
