const moment = require("moment");
const qs = require("qs");
const crypto = require("crypto");
const config = require("../../config/vnpay");
const SlotReservation = require("../models/SlotReservation");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");

function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  keys.forEach((key) => {
    sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, "+");
  });
  return sorted;
}

function buildReturnUrl(baseUrl, params) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  return `${baseUrl}?${searchParams.toString()}`;
}

function parseRawParams(queryString) {
  const rawParams = {};

  queryString.split("&").forEach((item) => {
    if (!item) return;
    const separatorIndex = item.indexOf("=");
    if (separatorIndex === -1) {
      rawParams[item] = "";
      return;
    }

    const key = item.slice(0, separatorIndex);
    const value = item.slice(separatorIndex + 1);
    rawParams[key] = value;
  });

  return rawParams;
}

async function applyPaymentResult(holdId, code) {
  const hold = holdId ? await SlotReservation.findById(holdId) : null;

  if (!hold) {
    return { hold: null, createdBooking: null };
  }

  if (code === "00") {
    hold.status = "booked";
    hold.paymentResult = "success";
    hold.paymentTime = new Date();
    await hold.save();

    const qr = `QR-${hold._id}`;
    let booking = await Booking.findOne({ qrToken: qr });

    if (!booking) {
      booking = new Booking({
        userId: hold.userId,
        subPitchId: hold.subPitchId,
        date: hold.date,
        startTime: hold.start,
        endTime: hold.end,
        status: "completed",
        paymentOption: "deposit_online",
        depositPercent: 0.3,
        totalAmount: hold.price || hold.amount || 0,
        currency: "VND",
        qrToken: qr,
        createdAt: new Date(),
      });

      await booking.save();
    }

    hold.bookingId = booking._id;
    await hold.save();

    await Payment.findOneAndUpdate(
      { bookingId: booking._id, method: "vnpay" },
      {
        $set: {
          amount: booking.totalAmount,
          currency: booking.currency || "VND",
          status: "paid",
        },
        $setOnInsert: {
          method: "vnpay",
          gatewayTxnId: `mock-vnpay-${hold._id}`,
        },
      },
      { upsert: true, new: true }
    );

    return { hold, createdBooking: booking };
  }

  hold.status = "hold";
  hold.held = true;
  hold.paymentResult = "fail";
  hold.paymentTime = new Date();
  await hold.save();

  return { hold, createdBooking: null };
}

function resolveBackendReturnUrl(req) {
  const explicitUrl = config.vnp_ReturnUrl;
  if (
    explicitUrl &&
    !explicitUrl.includes("127.0.0.1") &&
    !explicitUrl.includes("your-api-gateway-id")
  ) {
    return explicitUrl;
  }

  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  return `${protocol}://${req.get("host")}/api/vnpay/return`;
}

exports.createPayment = async (req, res) => {
  try {
    process.env.TZ = "Asia/Ho_Chi_Minh";
    const date = new Date();
    const createDate = moment(date).format("YYYYMMDDHHmmss");
    const orderId = moment(date).format("DDHHmmss");

    let ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.ip;

    // IPv4 Fix: VNPAY does not accept IPv6 like ::1
    if (!ipAddr || ipAddr === "::1" || ipAddr.includes(":")) {
      ipAddr = "127.0.0.1";
    }

    const { vnp_TmnCode, vnp_HashSecret, vnp_Url } = config;
    const { amount, holdId, appReturnUrl, appFailUrl } = req.body || {};
    const bankCode = "NCB";

    if (!amount || !holdId) {
      return res.status(400).json({ message: "Thiếu thông tin thanh toán" });
    }

    if (holdId) {
      await SlotReservation.findByIdAndUpdate(holdId, {
        appReturnUrl,
        appFailUrl,
      });
    }

    const returnUrl = buildReturnUrl(resolveBackendReturnUrl(req), {
      holdId,
      appReturnUrl,
      appFailUrl,
    });

    let vnp_Params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: orderId,
      vnp_OrderInfo: `Thanh toan san bong holdId ${holdId}`,
      vnp_OrderType: "billpayment",
      vnp_Amount: Math.round(Number(amount) * 100),
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
      vnp_BankCode: bankCode,
    };

    vnp_Params = sortObject(vnp_Params);

    const signData = qs.stringify(vnp_Params, { encode: false });
    const signed = crypto
      .createHmac("sha512", vnp_HashSecret)
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    vnp_Params.vnp_SecureHash = signed;

    const paymentUrl = `${vnp_Url}?${qs.stringify(vnp_Params, {
      encode: false,
    })}`;

    console.log("VNPay payment URL created:", paymentUrl);
    return res.json({ paymentUrl });
  } catch (err) {
    console.error("createPayment error:", err);
    return res.status(500).json({ message: "Tạo link thanh toán thất bại" });
  }
};

exports.vnpayReturn = async (req, res) => {
  try {
    const secretKey = config.vnp_HashSecret;
    const url = req.originalUrl;
    const queryString = url.includes("?") ? url.substring(url.indexOf("?") + 1) : "";
    const rawParams = parseRawParams(queryString);

    const clientHash = rawParams.vnp_SecureHash;
    delete rawParams.vnp_SecureHash;
    delete rawParams.vnp_SecureHashType;

    let holdId = req.query.holdId || null;
    const orderInfo = decodeURIComponent(rawParams.vnp_OrderInfo || "");
    const match = orderInfo.match(/holdId=([a-f0-9]{24})/i);
    if (!holdId && match) {
      holdId = match[1];
    }

    const sortedRaw = {};
    Object.keys(rawParams)
      .filter((key) => key.startsWith("vnp_"))
      .sort()
      .forEach((key) => {
        sortedRaw[key] = rawParams[key];
      });

    const signData = Object.entries(sortedRaw)
      .map(([key, value]) => `${key}=${value}`)
      .join("&");

    const serverHash = crypto
      .createHmac("sha512", secretKey)
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    if (clientHash !== serverHash) {
      console.log("VNPay checksum mismatch");
      return res.status(400).send("Checksum failed");
    }

    const code = rawParams.vnp_ResponseCode;
    const result = await applyPaymentResult(holdId, code);

    if (!result.hold) {
      console.log("VNPay return could not find hold:", holdId);
    }

    const successTarget =
      req.query.appReturnUrl ||
      result.hold?.appReturnUrl ||
      (config.fe_Base ? `${config.fe_Base}/--/payment-success` : "");
    const failTarget =
      req.query.appFailUrl ||
      result.hold?.appFailUrl ||
      (config.fe_Base ? `${config.fe_Base}/--/payment-fail` : "");
    let appTarget = code === "00" ? successTarget : failTarget;

    if (appTarget && result.hold) {
      const sep = appTarget.includes("?") ? "&" : "?";
      appTarget += `${sep}holdId=${result.hold._id}&subPitchId=${result.hold.subPitchId}`;
    }

    const title =
      code === "00" ? "Thanh toan thanh cong" : "Thanh toan that bai";
    const message =
      code === "00"
        ? "San da duoc xac nhan. Ban co the quay lai ung dung."
        : "Giao dich khong thanh cong. Vui long thu lai trong ung dung.";
    const color = code === "00" ? "#16a34a" : "#dc2626";

    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ket qua thanh toan</title>
  <style>
    body { font-family: -apple-system, Roboto, sans-serif; text-align: center; padding-top: 70px; background-color: #f8fafc; }
    h2 { color: ${color}; font-weight: 600; }
    a { color: white; background-color: #22c55e; font-weight: 500; text-decoration: none; padding: 12px 22px; border-radius: 10px; display: inline-block; margin-top: 20px; }
  </style>
</head>
<body>
  <h2>${title}</h2>
  <p>${message}</p>
  ${appTarget ? `<a href="${appTarget}">Mo ung dung</a>` : ""}
  <script>
    ${
      appTarget
        ? `setTimeout(() => { window.location.href = "${appTarget}"; }, 1500);`
        : ""
    }
  </script>
</body>
</html>`;

    return res.send(html);
  } catch (err) {
    console.error("vnpayReturn error:", err);
    return res.status(500).json({ message: "Lỗi callback từ VNPay" });
  }
};

exports.mockPaymentResult = async (req, res) => {
  try {
    const { holdId, result } = req.body || {};
    const code = result === "success" ? "00" : "24";

    if (!holdId) {
      return res.status(400).json({ message: "Thiếu holdId" });
    }

    const paymentResult = await applyPaymentResult(holdId, code);
    if (!paymentResult.hold) {
      return res.status(404).json({ message: "Không tìm thấy hold" });
    }

    return res.json({
      message:
        code === "00"
          ? "Mock thanh toán thành công"
          : "Mock thanh toán thất bại",
      result: code === "00" ? "success" : "fail",
      hold: paymentResult.hold,
      booking: paymentResult.createdBooking,
    });
  } catch (err) {
    console.error("mockPaymentResult error:", err);
    return res.status(500).json({ message: "Lỗi mock thanh toán" });
  }
};

exports.vnpayIpn = async (req, res) => {
  console.log("VNPay IPN:", req.query);
  return res.status(200).json({ RspCode: "00", Message: "Received" });
};
