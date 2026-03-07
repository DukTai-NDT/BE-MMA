const express = require("express");
const {
  getAvailableSlots,
  getReviews,
} = require("../controllers/subPitchController");

const router = express.Router();

//  Slot cho sân con
router.get("/sub-pitches/:id/slots", getAvailableSlots);

//  Review của sân con
router.get("/sub-pitches/:id/reviews", getReviews);

module.exports = router;
