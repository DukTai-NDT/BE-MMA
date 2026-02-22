const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    subPitchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubPitch",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true },
  },
  { collection: "reviews", timestamps: { createdAt: true, updatedAt: false } }
);

// Unique per booking
ReviewSchema.index({ bookingId: 1 }, { unique: true });

module.exports = mongoose.model("Review", ReviewSchema);
