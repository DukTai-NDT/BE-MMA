// src/controllers/subPitchController.js
const Joi = require("joi");
const SubPitch = require("../models/SubPitch");
const Venue = require("../models/Venue.js");
const Review = require("../models/Review");
const SlotReservation = require("../models/SlotReservation");
const mongoose = require("mongoose");
/**
 * Kiểm tra quyền sở hữu venue của owner
 */
const checkVenueOwnership = async (venueId, ownerId) => {
  if (!mongoose.Types.ObjectId.isValid(venueId)) return false;
  const venue = await Venue.findOne({ _id: venueId, ownerId: ownerId });
  return !!venue;
};

// @desc    Lấy danh sách sub-pitch của 1 venue (owner)
// @route   GET /owner/venues/:venueId/sub-pitches
const getSubPitchesByVenue = async (req, res) => {
  try {
    const { venueId } = req.params;
    const ownerId = req.user._id;

    const isOwner = await checkVenueOwnership(venueId, ownerId);
    if (!isOwner) {
      return res.status(403).json({ message: "Forbidden: You do not own this venue" });
    }

    const subPitches = await SubPitch.find({ venueId });
    res.json(subPitches);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Tạo sub-pitch mới cho 1 venue (owner)
// @route   POST /owner/venues/:venueId/sub-pitches
const createSubPitch = async (req, res) => {
  try {
    const { venueId } = req.params;
    const ownerId = req.user._id;

    const isOwner = await checkVenueOwnership(venueId, ownerId);
    if (!isOwner) {
      return res.status(403).json({ message: "Forbidden: You do not own this venue" });
    }

    const subPitchData = { ...req.body, venueId };
    const newSubPitch = new SubPitch(subPitchData);
    await newSubPitch.save();
    res.status(201).json(newSubPitch);
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: "Validation Error", errors: error.errors });
    }
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Helper kiểm tra quyền sở hữu sub-pitch (owner)
const checkSubPitchOwnership = async (subPitchId, ownerId) => {
  if (!mongoose.Types.ObjectId.isValid(subPitchId)) return null;
  const subPitch = await SubPitch.findById(subPitchId);
  if (!subPitch) return null;
  const isOwner = await checkVenueOwnership(subPitch.venueId, ownerId);
  return isOwner ? subPitch : null;
};

// @desc    Cập nhật sub-pitch (owner)
// @route   PUT /owner/sub-pitches/:id
const updateSubPitch = async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user._id;
    const subPitch = await checkSubPitchOwnership(id, ownerId);
    if (!subPitch) {
      return res.status(403).json({ message: "Forbidden: Sub-pitch not found or you do not own it" });
    }
    const updatedSubPitch = await SubPitch.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    res.json(updatedSubPitch);
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: "Validation Error", errors: error.errors });
    }
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Xóa sub-pitch (owner)
// @route   DELETE /owner/sub-pitches/:id
const deleteSubPitch = async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user._id;
    const subPitch = await checkSubPitchOwnership(id, ownerId);
    if (!subPitch) {
      return res.status(403).json({ message: "Forbidden: Sub-pitch not found or you do not own it" });
    }
    await SubPitch.findByIdAndDelete(id);
    res.json({ message: "Sub-pitch deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Public endpoints used by /api routes
//  GET /api/venues/:venueId/sub-pitches
const getSubPitches = async (req, res) => {
  try {
    const schema = Joi.object({ venueId: Joi.string().length(24).required() });
    const { error } = schema.validate(req.params);
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    const subs = await SubPitch.find({ venueId: req.params.venueId });
    res.json(subs);
  } catch (err) {
    console.error("❌ getSubPitches error:", err);
    res.status(500).json({ message: err.message });
  }
};

//  GET /api/sub-pitches/:id/reviews
const getReviews = async (req, res) => {
  try {
    const schema = Joi.object({ id: Joi.string().length(24).required() });
    const { error } = schema.validate(req.params);
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    const reviews = await Review.find({ subPitchId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(reviews);
  } catch (err) {
    console.error("❌ getReviews error:", err);
    res.status(500).json({ message: err.message });
  }
};

//  GET /api/sub-pitches/:id/slots?date=YYYY-MM-DD
// const getAvailableSlots = async (req, res) => {
//   try {
//     const schemaParams = Joi.object({ id: Joi.string().length(24).required() });
//     const schemaQuery = Joi.object({
//       date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
//     });

//     const { error: errP } = schemaParams.validate(req.params);
//     if (errP) return res.status(400).json({ message: errP.details[0].message });

//     const { error: errQ } = schemaQuery.validate(req.query);
//     if (errQ) return res.status(400).json({ message: errQ.details[0].message });

//     const subPitch = await SubPitch.findById(req.params.id).lean();
//     if (!subPitch) return res.status(404).json({ message: "SubPitch not found" });

//     // lấy các slot đã hold/booked của ngày đó
//     const reserved = await SlotReservation.find({
//       subPitchId: req.params.id,
//       date: req.query.date,
//       status: { $in: ["booked", "hold"] },
//     }).lean();

//     const heldIndexes = new Set(
//       reserved.filter((r) => r.status === "hold").map((r) => r.slotIndex)
//     );
//     const bookedIndexes = new Set(
//       reserved.filter((r) => r.status === "booked").map((r) => r.slotIndex)
//     );

//     const slots = (subPitch.bookableBlocks || []).map((b, index) => {
//       const keyColon = `${b.start}-${b.end}`;
//       const keyDash = `${b.start.split(":")[0]}-${b.end.split(":")[0]}`;
//       const price =
//         subPitch.blockPrices?.[keyColon] ??
//         subPitch.blockPrices?.[keyDash] ??
//         0;

//       return {
//         slotIndex: index,
//         start: b.start,
//         end: b.end,
//         label: `${b.start} - ${b.end}`,
//         price,
//         booked: bookedIndexes.has(index),
//         held: heldIndexes.has(index),
//       };
//     });

//     res.json({
//       date: req.query.date,
//       available: slots,
//     });
//   } catch (err) {
//     console.error("❌ getAvailableSlots error:", err);
//     res.status(500).json({ message: err.message });
//   }
// };


//  GET /api/sub-pitches/:id/slots?date=YYYY-MM-DD
const getAvailableSlots = async (req, res) => {
  try {
    const schemaParams = Joi.object({ id: Joi.string().length(24).required() });
    const schemaQuery = Joi.object({
      date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    });

    const { error: errP } = schemaParams.validate(req.params);
    if (errP) return res.status(400).json({ message: errP.details[0].message });

    const { error: errQ } = schemaQuery.validate(req.query);
    if (errQ) return res.status(400).json({ message: errQ.details[0].message });

  const subPitch = await SubPitch.findById(req.params.id).lean();
    if (!subPitch)
      return res.status(404).json({ message: "SubPitch not found" });

    //  Lấy các slot đã hold/booked/payment fail của ngày đó
    const reserved = await SlotReservation.find({
      subPitchId: req.params.id,
      date: req.query.date,
      status: { $in: ["booked", "hold"] },
    }).lean();

    //  Map từng slot ra, có gì thì merge thông tin reservation vào
    const slots = Array.isArray(subPitch.bookableBlocks)
      ? subPitch.bookableBlocks.map((b, index) => {
          const keyColon = `${b.start}-${b.end}`;
          const keyDash = `${b.start.split(":")[0]}-${b.end.split(":")[0]}`;
          const price =
            subPitch.blockPrices?.[keyColon] ??
            subPitch.blockPrices?.[keyDash] ??
            0;

             // slot reservation tương ứng (nếu có)
      const currentHold = reserved.find((r) => r.slotIndex === index);

      //  QUY TẮC:
      // - paymentResult === "success"  -> booked = true (đỏ)
      // - status === "booked"          -> booked = true (đỏ)
      // - status === "hold" && paymentResult !== "success"
      //                                 -> held = true (vàng)
      let booked = false;
      let held = false;

      if (currentHold) {
        if (
          currentHold.paymentResult === "success" ||
          currentHold.status === "booked"
        ) {
          booked = true;
        } else if (
          currentHold.status === "hold" &&
          currentHold.paymentResult !== "success"
        ) {
          held = true;
        }
      }

          return {
            slotIndex: index,
            start: b.start,
            end: b.end,
            label: `${b.start} - ${b.end}`,
            price,
            booked: currentHold?.status === "booked" || false,
            held: currentHold?.status === "hold" || false,   // vẫn vàng nếu fail
            paymentResult: currentHold?.paymentResult || null,
            _id: currentHold?._id || null,
          };
        })
      : [];

    res.json({
      date: req.query.date,
      available: slots,
    });
  } catch (err) {
    console.error("❌ getAvailableSlots error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  // owner
  getSubPitchesByVenue,
  createSubPitch,
  updateSubPitch,
  deleteSubPitch,
  // public
  getSubPitches,
  getReviews,
  getAvailableSlots,
};
