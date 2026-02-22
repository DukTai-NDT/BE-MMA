const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    method: {
      type: String,
      enum: ["vnpay", "momo", "cash", "other"],
      required: true,
    },
    gatewayTxnId: { type: String, trim: true },
    amount: { type: Number, min: 0, required: true },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: ["initiated", "paid", "failed", "refunded", "chargeback"],
      required: true,
      default: "initiated",
    },
  },
  { collection: "payments", timestamps: true }
);

// Indexes
PaymentSchema.index({ bookingId: 1 });
PaymentSchema.index({ gatewayTxnId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Payment", PaymentSchema);
