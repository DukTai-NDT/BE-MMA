const mongoose = require("mongoose");

const TimeRegex = /^\d{2}:\d{2}$/; // HH:MM

const BookableBlockSchema = new mongoose.Schema(
  {
    start: { type: String, match: TimeRegex, required: true },
    end: { type: String, match: TimeRegex, required: true },
    label: { type: String, trim: true },
  },
  { _id: false }
);

const SubPitchSchema = new mongoose.Schema(
  {
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["5v5", "7v7", "9v9", "11v11"],
      required: true,
    },
    active: { type: Boolean, required: true },
    bookableBlocks: { type: [BookableBlockSchema], default: [] },
    // Map from 'HH:MM-HH:MM' -> price (Number)
    blockPrices: { type: Map, of: Number, default: {} },
  },
  { collection: "sub_pitches", timestamps: true }
);

// Indexes
SubPitchSchema.index({ venueId: 1, active: 1 });
SubPitchSchema.index({ type: 1 });

module.exports = mongoose.model("SubPitch", SubPitchSchema);
