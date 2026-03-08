const express = require("express");
const router = express.Router();
const { getOwnerSlots } = require("../controllers/ownerSlotController");
const { checkAuth, checkRole } = require("../middleware/auth");

// Owner view: only owner (or admin) can access slots for their sub-pitch
router.get(
  "/owner/sub-pitches/:id/slots",
  checkAuth,
  checkRole(["owner", "admin"]),
  getOwnerSlots
);

module.exports = router;
