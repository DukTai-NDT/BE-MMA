// src/controllers/adminVenueController.js
const Venue = require("../models/Venue");

// [GET] /admin/venues?status=&search=
exports.listVenues = async (req, res) => {
    try {
        const { status, search } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (search) filter.name = { $regex: search, $options: "i" };

        const venues = await Venue.find(filter).populate("ownerId", "name email");
        res.json(venues);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// [PATCH] /admin/venues/:id/status
exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // "active" | "inactive"
        const venue = await Venue.findByIdAndUpdate(id, { status }, { new: true });
        if (!venue) return res.status(404).json({ message: "Venue not found" });
        res.json(venue);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// [PATCH] /admin/venues/:id/approve
exports.approveVenue = async (req, res) => {
    try {
        const { id } = req.params;
        const venue = await Venue.findByIdAndUpdate(
            id,
            { isApproved: true, status: "active" },
            { new: true }
        );
        if (!venue) return res.status(404).json({ message: "Venue not found" });
        res.json(venue);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
