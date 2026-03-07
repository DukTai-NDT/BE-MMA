const express = require("express");
const {
  listVenues,
  getVenue,
  getSubPitchesByVenue,
} = require("../controllers/venueController");

const router = express.Router();

//  Lấy danh sách sân
router.get("/", listVenues);

//  Lấy chi tiết 1 sân
router.get("/:id", getVenue);

//  Lấy danh sách sân con thuộc sân đó
router.get("/:id/sub-pitches", getSubPitchesByVenue);

module.exports = router;
