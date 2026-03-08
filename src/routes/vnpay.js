const express = require("express");
const {
  createPayment,
  vnpayReturn,
  vnpayIpn,
} = require("../controllers/vnpayController");

const router = express.Router();

//  Tạo URL thanh toán
router.post("/create", createPayment);

//  Callback sau khi thanh toán (VNPAY redirect)
router.get("/return", vnpayReturn);

//  IPN callback (server → server)
router.get("/ipn", vnpayIpn);

module.exports = router;
