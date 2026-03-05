// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { User } = require('../models'); // Giả sử bạn import User từ index

// Lấy JWT_SECRET, khớp với file authController của bạn
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

// 1. Middleware bảo vệ (PHIÊN BẢN THẬT)
const protect = async (req, res, next) => {
  let token;

  // 1. Đọc token từ header 'Authorization'
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Lấy token (bỏ chữ 'Bearer ' ở đầu)
      token = req.headers.authorization.split(' ')[1];

      // 2. Xác thực (verify) token
      // Nó sẽ dùng JWT_SECRET để giải mã payload của bạn
      const decoded = jwt.verify(token, JWT_SECRET);

      // 3. Lấy user từ DB
      // THAY ĐỔI QUAN TRỌNG: Đọc 'decoded.sub' (thay vì 'decoded.id')
      req.user = await User.findById(decoded.sub).select('-passHash'); 

      if (!req.user) {
         return res.status(401).json({ message: 'User không tồn tại' });
      }

      // 4. Cho đi tiếp
      next();

    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Không được phép, token không hợp lệ' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Không được phép, không có token' });
  }
};

// 2. Middleware kiểm tra vai trò 'owner' (Giữ nguyên)
// Nó đọc req.user.roles, mà req.user đã được hàm protect ở trên gán vào
const isOwner = (req, res, next) => {
  if (req.user && req.user.roles.includes('owner')) {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Access denied, "owner" role required' });
  }
};

module.exports = { protect, isOwner };