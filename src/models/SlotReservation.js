const mongoose = require("mongoose");

const DateRegex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD

const SlotReservationSchema = new mongoose.Schema(
  {
    subPitchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubPitch",
      required: true,
    },
    date: { type: String, match: DateRegex, required: true },
    slotIndex: { type: Number, min: 0, required: true },
    status: { type: String, enum: ["hold", "booked"], required: true },
    paymentResult: {
      type: String,
      enum: ["pending", "success", "fail", null],
      default: "pending",
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    start: { type: String, match: /^\d{2}:\d{2}$/ },
    end: { type: String, match: /^\d{2}:\d{2}$/ },
    price: { type: Number, min: 0 },
    start: { type: String, match: /^\d{2}:\d{2}$/ },
    end: { type: String, match: /^\d{2}:\d{2}$/ },
    price: { type: Number, min: 0 },

    appReturnUrl: String,
    appFailUrl: String,
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    expiresAt: { type: Date },
  },
  {
    collection: "slot_reservations",
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
SlotReservationSchema.index(
  { subPitchId: 1, date: 1, slotIndex: 1 },
  { unique: true, name: "uniq_slot" }
);
// TTL index on expiresAt: expire immediately after the time passes
SlotReservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("SlotReservation", SlotReservationSchema);
