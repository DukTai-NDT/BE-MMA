const mongoose = require("mongoose");

const DateRegex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
const TimeRegex = /^\d{2}:\d{2}$/; // HH:MM

const BookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subPitchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubPitch",
      required: true,
    },
    date: { type: String, match: DateRegex, required: true },
    startTime: { type: String, match: TimeRegex, required: true },
    endTime: { type: String, match: TimeRegex, required: true },
    status: {
      type: String,
      enum: [
        "pending_payment",
        "confirmed",
        "cancelled",
        "completed",
        "refunded",
        "no_show",
      ],
      required: true,
      default: "pending_payment",
    },
    paymentOption: {
      type: String,
      enum: ["full_online", "deposit_online", "pay_on_site"],
      required: true,
    },
    depositPercent: { type: Number, min: 0, max: 1 },
    totalAmount: { type: Number, min: 0, required: true },
    currency: { type: String, required: true },
    qrToken: { type: String, trim: true },
    paymentDeadlineAt: { type: Date },
    notes: { type: String, trim: true },
  },
  { collection: "bookings", timestamps: true }
);

// Indexes
BookingSchema.index({ userId: 1, createdAt: -1 });
BookingSchema.index({ subPitchId: 1, date: 1 });
BookingSchema.index({ status: 1, paymentDeadlineAt: 1 });

module.exports = mongoose.model("Booking", BookingSchema);
