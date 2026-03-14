// src/controllers/adminUserController.js
const User = require("../models/User");

// [GET] /admin/users?role=&status=&search=
exports.listUsers = async (req, res) => {
  try {
    const { role, status, search } = req.query;
    const filter = {};

    // roles is an array in schema -> filter by element match
    if (role) filter.roles = role;
    if (status) filter.status = status;

    if (search) {
      const rx = new RegExp(search, "i");
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }

    // Avoid leaking password hash
    const users = await User.find(filter).select("-passHash");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [PATCH] /admin/users/:id/status
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // "active" | "banned"
    const user = await User.findByIdAndUpdate(id, { status }, { new: true });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [PATCH] /admin/users/:id/roles
// Chuyển đổi role đơn thành mảng roles theo schema và đảm bảo không trùng lặp
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body; // "customer" | "owner" | "admin"
    if (!role) return res.status(400).json({ message: "Missing role" });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const roles = Array.isArray(user.roles) ? [...user.roles] : [];
    if (!roles.includes(role)) roles.push(role);

    user.roles = roles;
    await user.save();

    // Không trả passHash
    const userObj = user.toObject();
    delete userObj.passHash;
    res.json(userObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
