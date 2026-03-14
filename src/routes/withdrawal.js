// ./src/routes/withdrawal.js
const express = require("express");
const router = express.Router();
const withdrawal = require("../controllers/withdrawalController");

const { checkAuth, checkRole } = require("../middleware/auth");

router.get(
  "/owner/balance",
  checkAuth,
  checkRole(["owner"]), 
  withdrawal.getOwnerBalance
);

router.post(
  "/owner/request",
  checkAuth,
  checkRole(["owner"]),
  withdrawal.requestWithdrawal
);

router.get(
  "/owner/history",
  checkAuth,
  checkRole(["owner"]), 
  withdrawal.getOwnerWithdrawals
);

router.get(
  "/admin/list",
  checkAuth,
  checkRole(["admin"]), 
  withdrawal.getAdminWithdrawals
);

router.post(
  "/admin/approve/:id",
  checkAuth,
  checkRole(["admin"]), 
  withdrawal.approveWithdrawal
);

router.post(
  "/admin/reject/:id",
  checkAuth,
  checkRole(["admin"]),
  withdrawal.rejectWithdrawal
);

module.exports = router;