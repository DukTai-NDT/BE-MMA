const mongoose = require("mongoose");

const TimeRegex = /^\d{2}:\d{2}$/; // HH:MM

const VenueSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    area: { type: String, trim: true },
    images: [{ type: String, trim: true }],
    contact: {
      phone: { type: String, trim: true },
      email: { type: String, trim: true },
      zalo: { type: String, trim: true },
      facebook: { type: String, trim: true },
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (v) => Array.isArray(v) && v.length >= 2,
          message: "coordinates must have at least [lng, lat]",
        },
      },
    },
    hours: {
      open: { type: String, match: TimeRegex, required: true },
      close: { type: String, match: TimeRegex, required: true },
    },
    status: {
      type: String,
      enum: ["active", "hidden"],
      default: "active",
      required: true,
    },
    ratingAvg: { type: Number },
    ratingCount: { type: Number },
  },
  { collection: "venues", timestamps: true }
);

// Indexes
VenueSchema.index({ location: "2dsphere" });
VenueSchema.index({ name: "text", address: "text", area: "text" });

module.exports = mongoose.model("Venue", VenueSchema);
