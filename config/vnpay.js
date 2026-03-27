module.exports = {
  vnp_TmnCode: process.env.VNP_TMNCODE || "Q5NBNGQ5",
  vnp_HashSecret:
    process.env.VNP_HASH_SECRET || "OYJ7ZN87KWJJ3J0HVZSFJSBSDOUJAOSF",
  vnp_Url:
    process.env.VNP_URL ||
    "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  vnp_Api:
    process.env.VNP_API ||
    "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
  vnp_ReturnUrl:
    process.env.VNP_RETURN_URL || "http://127.0.0.1:9999/api/vnpay/return",
  fe_Base: process.env.FE_BASE || "",
};
