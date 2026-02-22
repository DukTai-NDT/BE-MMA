// ./src/models/WithdrawalRequest.js
const mongoose = require("mongoose");

const BankInfoSchema = new mongoose.Schema(
  {
    accountName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    bankName: { type: String, required: true, trim: true },
    qrCodeImageUrl: { type: String, trim: true }, // Link ảnh QR (nếu có)
  },
  { _id: false }
);

const WithdrawalRequestSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: { type: Number, min: 0, required: true },
    currency: { type: String, required: true, default: "VND" },
    status: {
      type: String,
      enum: ["pending", "processing", "success", "rejected"],
      required: true,
      default: "pending",
    },
    bankInfo: { type: BankInfoSchema, required: true },
    rejectionReason: { type: String, trim: true }, // Lý do admin từ chối
    processedBy: {
      type: mongoose.Schema.Types.ObjectId, // Admin xử lý
      ref: "User",
    },
    requestedAt: { type: Date, default: Date.now, required: true },
    processedAt: { type: Date }, // Ngày admin xử lý
  },
  { collection: "withdrawal_requests", timestamps: false } // Tắt timestamps vì đã tự quản lý ngày
);

// Indexes
WithdrawalRequestSchema.index({ ownerId: 1, status: 1, requestedAt: -1 });
WithdrawalRequestSchema.index({ status: 1, requestedAt: 1 });

module.exports = mongoose.model("WithdrawalRequest", WithdrawalRequestSchema);