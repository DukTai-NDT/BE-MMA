const moment = require("moment");
const qs = require("qs");
const crypto = require("crypto");
const config = require("../../config/vnpay");
const SlotReservation = require("../models/SlotReservation"); //  dùng để lấy subPitchId sau khi thanh toán
const Booking = require("../models/Booking");

// Hàm sort object chuẩn VNPay (encode + sort key)
function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  keys.forEach((key) => {
    sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, "+");
  });
  return sorted;
}

//  Tạo link thanh toán VNPay

exports.createPayment = async (req, res) => {
  try {
    process.env.TZ = "Asia/Ho_Chi_Minh";
    const date = new Date();
    const createDate = moment(date).format("YYYYMMDDHHmmss");
    const orderId = moment(date).format("DDHHmmss");

    const ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.ip;

    const { vnp_TmnCode, vnp_HashSecret, vnp_Url, vnp_ReturnUrl } = config;
    const { amount, holdId } = req.body;
    const bankCode = "NCB";

    if (!amount || !holdId)
      return res.status(400).json({ message: "Thiếu thông tin thanh toán" });

    // VNPay callback sẽ gọi về backend /api/vnpay/return
    // backend sẽ redirect về FE
    const returnUrlWithHoldId = `${vnp_ReturnUrl}?holdId=${holdId}`;

    let vnp_Params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: orderId,
      vnp_OrderInfo: `Thanh toán sân bóng (holdId=${holdId})`,
      vnp_OrderType: "billpayment",
      vnp_Amount: amount * 100, // VNPay yêu cầu nhân 100
      vnp_ReturnUrl: returnUrlWithHoldId,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
      vnp_BankCode: bankCode,
    };

    vnp_Params = sortObject(vnp_Params);

    const signData = qs.stringify(vnp_Params, { encode: false });
    const signed = crypto
      .createHmac("sha512", vnp_HashSecret)
      .update(signData, "binary")
      .digest("hex");

    vnp_Params.vnp_SecureHash = signed;

    const paymentUrl = `${vnp_Url}?${qs.stringify(vnp_Params, {
      encode: false,
    })}`;

    console.log("✅ Tạo link thanh toán thành công:");
    console.log(paymentUrl);
    res.json({ paymentUrl });
  } catch (err) {
    console.error("❌ createPayment error:", err);
    res.status(500).json({ message: "Tạo link thanh toán thất bại" });
  }
};

//  Callback sau thanh toán (VNPay gọi về backend)

exports.vnpayReturn = async (req, res) => {
  try {
    const secretKey = config.vnp_HashSecret;
    const url = req.originalUrl;
    const queryString = url.substring(url.indexOf("?") + 1);

    // Parse params từ VNPay
    const rawParams = {};
    queryString.split("&").forEach((item) => {
      const [key, value] = item.split("=");
      rawParams[key] = value;
    });

    const clientHash = rawParams["vnp_SecureHash"];
    delete rawParams["vnp_SecureHash"];
    delete rawParams["vnp_SecureHashType"];

    // 🔍 Lấy holdId từ vnp_OrderInfo (VNPay không trả holdId trong query)
    let holdId = null;
    const orderInfo = decodeURIComponent(rawParams["vnp_OrderInfo"] || "");
    const match = orderInfo.match(/holdId=([a-f0-9]{24})/); // regex cho ObjectId 24 ký tự
    if (match) {
      holdId = match[1];
      console.log("✅ Trích xuất holdId từ vnp_OrderInfo:", holdId);
    } else {
      console.log("⚠️ Không tìm thấy holdId trong vnp_OrderInfo:", orderInfo);
    }

    // Sort lại các param VNPay
    const sortedRaw = {};
    Object.keys(rawParams)
      .filter((k) => k.startsWith("vnp_"))
      .sort()
      .forEach((key) => {
        sortedRaw[key] = rawParams[key];
      });

    const signData = Object.entries(sortedRaw)
      .map(([k, v]) => `${k}=${v}`)
      .join("&");

    const serverHash = crypto
      .createHmac("sha512", secretKey)
      .update(signData, "binary")
      .digest("hex");

    if (clientHash !== serverHash) {
      console.log("⚠️ Checksum sai (VNPay → server)");
      return res.status(400).send("Checksum failed");
    }

    const code = rawParams["vnp_ResponseCode"];
    const hold = holdId ? await SlotReservation.findById(holdId) : null;
    if (!hold) {
      console.log("⚠️ Không tìm thấy SlotReservation với holdId:", holdId);
    } else {
      if (code === "00") {
        console.log("✅ Thanh toán thành công cho holdId:", holdId);
        hold.status = "booked"; // đổi từ hold -> booked
        hold.paymentResult = "success";
        hold.paymentTime = new Date();
        await hold.save();

        // Tạo booking mới nếu chưa có
        const qr = `QR-${hold._id}`;
        const existingBooking = await Booking.findOne({ qrToken: qr });

        if (!existingBooking) {
          const booking = new Booking({
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
          console.log("🟢 Booking mới được lưu:", booking._id);
        } else {
          console.log("⚠️ Booking đã tồn tại, bỏ qua tạo mới");
        }
      } else {
        console.log("❌ Thanh toán thất bại:", code);
        hold.status = "hold"; // vẫn giữ vàng
        hold.held = true; // để FE hiểu là slot đang được giữ
        hold.paymentResult = "fail"; //  quan trọng để FE dừng refresh
        hold.paymentTime = new Date();
        await hold.save();
      }

      await hold.save();
    }

    //  FE base URL: địa chỉ Expo Go
    const FE_BASE = "exp://192.168.1.104:8081";

    const title =
      code === "00" ? "✅ Thanh toán thành công!" : "❌ Thanh toán thất bại!";
    const message =
      code === "00"
        ? "Sân đã được xác nhận. Bạn có thể mở lại ứng dụng để xem trạng thái."
        : "Giao dịch không thành công. Vui lòng thử lại trong ứng dụng.";
    const color = code === "00" ? "#16a34a" : "#dc2626";

    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kết quả thanh toán</title>
  <style>
    body { font-family: -apple-system, Roboto, sans-serif; text-align: center; padding-top: 70px; background-color: #f8fafc; }
    h2 { color: ${color}; font-weight: 600; }
    a { color: white; background-color: #22c55e; font-weight: 500; text-decoration: none; padding: 12px 22px; border-radius: 10px; display: inline-block; margin-top: 20px; }
  </style>
</head>
<body>
  <h2>${title}</h2>
  <p>${message}</p>
  <a href="${FE_BASE}">Mở ứng dụng</a>
  <script>
    setTimeout(() => { window.location.href = "${FE_BASE}"; }, 1500);
  </script>
</body>
</html>`;
    return res.send(html);
  } catch (err) {
    console.error("❌ vnpayReturn error:", err);
    return res.status(500).json({ message: "Lỗi callback từ VNPay" });
  }
};

// IPN (Server to Server — ít dùng)

exports.vnpayIpn = async (req, res) => {
  console.log("📩 VNPay IPN:", req.query);
  res.status(200).json({ RspCode: "00", Message: "Received" });
};
