// src/routes/holds.js
const express = require("express");
const Joi = require("joi");
const { createHold, deleteHold } = require("../controllers/holdsController");
const { checkAuth } = require("../middleware/auth");

const router = express.Router();

const holdSchema = Joi.object({
  subPitchId: Joi.string().length(24).required(),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  slotIndex: Joi.number().integer().min(0).required(),
});

// POST /api/holds (auth required)
router.post("/", checkAuth, async (req, res) => {
  const { error } = holdSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  await createHold(req, res);
});

// DELETE /api/holds/:id (auth required)
const idSchema = Joi.object({ id: Joi.string().length(24).required() });
router.delete("/:id", checkAuth, async (req, res) => {
  const { error } = idSchema.validate(req.params);
  if (error) return res.status(400).json({ message: error.details[0].message });
  await deleteHold(req, res);
});

module.exports = router;
