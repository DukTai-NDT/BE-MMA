const express = require("express");
const {
  createPayment,
  vnpayReturn,
  vnpayIpn,
  mockPaymentResult,
} = require("../controllers/vnpayController");

const router = express.Router();

//  Tạo URL thanh toán
router.post("/create", createPayment);

//  Callback sau khi thanh toán (VNPAY redirect)
router.get("/return", vnpayReturn);

//  IPN callback (server → server)
router.get("/ipn", vnpayIpn);

//  Mock thanh toán để demo local không phụ thuộc cổng thật
router.post("/mock-result", mockPaymentResult);

module.exports = router;
