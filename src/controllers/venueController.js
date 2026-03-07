const Venue = require("../models/Venue");
const SubPitch = require("../models/SubPitch");
const mongoose = require("mongoose");

// Public: list venues with filters (supports nearby radius search)
const listVenues = async (req, res) => {
  try {
    const { search, type, lat, lng, radius, minPrice, maxPrice, minRating } =
      req.query;
    const matchBase = { status: "active" };
    if (minRating) matchBase.ratingAvg = { $gte: Number(minRating) };

    const hasLocation = lat && lng;
    const radiusKm = radius ? Number(radius) : 20; // default 20km

    let venues = [];

    if (hasLocation) {
      // Use aggregation with $geoNear to compute distance (km) and sort by nearest
      const nearPoint = {
        type: "Point",
        coordinates: [parseFloat(lng), parseFloat(lat)],
      };

      const pipeline = [
        {
          $geoNear: {
            near: nearPoint,
            spherical: true,
            distanceField: "distance", // in meters by default
            distanceMultiplier: 0.001, // convert to km
            maxDistance: radiusKm * 1000, // meters
            query: matchBase,
          },
        },
      ];

      // Apply text search after $geoNear if provided (Mongo restricts $text inside $geoNear in some versions)
      if (search) {
        pipeline.push({ $match: { $text: { $search: search } } });
      }

      pipeline.push({ $sort: { distance: 1 } });

      venues = await Venue.aggregate(pipeline).exec();
    } else {
      // Fallback: normal find + optional text search
      const query = { ...matchBase };
      if (search) query.$text = { $search: search };
      venues = await Venue.find(query).lean();
    }

    if (!venues.length) return res.json([]);

    const venueIds = venues.map((v) => v._id);
    const subPitches = await SubPitch.aggregate([
      { $match: { venueId: { $in: venueIds } } },
      { $project: { venueId: 1, prices: { $objectToArray: "$blockPrices" } } },
      { $unwind: "$prices" },
      {
        $group: {
          _id: "$venueId",
          minPrice: { $min: "$prices.v" },
          maxPrice: { $max: "$prices.v" },
        },
      },
    ]);

    const priceMap = Object.fromEntries(
      subPitches.map((sp) => [sp._id.toString(), sp])
    );
    let result = venues.map((v) => ({
      ...v,
      minPrice: priceMap[v._id.toString()]?.minPrice || 0,
      maxPrice: priceMap[v._id.toString()]?.maxPrice || 0,
    }));

    if (minPrice || maxPrice) {
      const min = minPrice ? Number(minPrice) : 0;
      const max = maxPrice ? Number(maxPrice) : Infinity;
      result = result.filter((v) => v.maxPrice >= min && v.minPrice <= max);
    }

    // If distance was computed, ensure results remain sorted by distance
    if (hasLocation) {
      result.sort(
        (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)
      );
    }

    res.json(result);
  } catch (err) {
    console.error("Error in listVenues:", err);
    res.status(500).json({ message: err.message });
  }
};

const getVenue = async (req, res) => {
  try {
    const { id: venueId } = req.params; // routes/venues.js uses :id
    const venue = await Venue.findById(venueId).lean();

    if (!venue) return res.status(404).json({ message: "Venue not found" });

    const subPitches = await SubPitch.find({ venueId }).lean();

    res.json({
      ...venue,
      subPitches: subPitches || [],
    });
  } catch (err) {
    console.error("Error in getVenue:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc    Lấy tất cả venues của owner đang đăng nhập (giả lập)
// @route   GET /owner/venues
const getMyVenues = async (req, res) => {
  try {
    // req.user._id được cung cấp bởi middleware 'protect' giả lập
    const venues = await Venue.find({ ownerId: req.user._id });
    res.json(venues);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Tạo một venue mới
// @route   POST /owner/venues
const createVenue = async (req, res) => {
  try {
    const files = req.files;
    let imageUrls = [];
    if (files && files.length > 0) {
      // 'file.path' là đường dẫn mà Multer lưu file
      // Ví dụ: "uploads/abc123xyz.jpg"
      // (Xem lưu ý bên dưới)
      imageUrls = files.map((file) => file.path);
    }
    const venueData = {
      ...req.body,
      images: imageUrls,
      ownerId: req.user._id, // Tự động gán ownerId là user đang đăng nhập (giả lập)
    };

    const newVenue = new Venue(venueData);
    const savedVenue = await newVenue.save();
    res.status(201).json(savedVenue);
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: "Validation Error", errors: error.errors });
    }
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Cập nhật thông tin venue
// @route   PUT /owner/venues/:id
const updateVenue = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid Venue ID" });
  }

  try {
    const updateData = { ...req.body };
    if (req.files && req.files.length > 0) {
      // TRƯỜNG HỢP 1: Có ảnh mới (Gửi bằng FormData)

      // 2a. Lấy link ảnh MỚI từ Cloudinary (req.files)
      const newImageUrls = req.files.map((file) => file.path); // 2b. Lấy link ảnh CŨ từ req.body.existingImages (frontend gửi)

      let existingImageUrls = [];
      if (req.body.existingImages) {
        // Đảm bảo nó luôn là mảng, dù frontend gửi 1 hay nhiều link
        existingImageUrls = Array.isArray(req.body.existingImages)
          ? req.body.existingImages
          : [req.body.existingImages];
      } // 2c. Gộp 2 mảng ảnh lại và GHI ĐÈ vào 'images' trong updateData

      updateData.images = [...existingImageUrls, ...newImageUrls];

      // Xóa key 'existingImages' thừa (không bắt buộc nhưng nên làm)
      delete updateData.existingImages;
    } else {
      // TRƯỜNG HỢP 2: Không có ảnh mới (Gửi bằng JSON)
      // Không cần làm gì cả.
      // 'updateData.images' đã là mảng ảnh cũ chính xác từ req.body
    }

    const updatedVenue = await Venue.findOneAndUpdate(
      { _id: id, ownerId: req.user._id }, // Kiểm tra ID và ownerId (giả lập)
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedVenue) {
      return res
        .status(404)
        .json({ message: "Venue not found or you are not the owner" });
    }
    res.json(updatedVenue);
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: "Validation Error", errors: error.errors });
    }
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Ẩn/hiện venue (cập nhật status)
// @route   PATCH /owner/venues/:id/status
const updateVenueStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid Venue ID" });
  }
  if (!["active", "hidden"].includes(status)) {
    return res
      .status(400)
      .json({ message: "Invalid status. Must be 'active' or 'hidden'." });
  }

  try {
    const updatedVenue = await Venue.findOneAndUpdate(
      { _id: id, ownerId: req.user._id }, // Kiểm tra ID và ownerId (giả lập)
      { $set: { status: status } },
      { new: true }
    );

    if (!updatedVenue) {
      return res
        .status(404)
        .json({ message: "Venue not found or you are not the owner" });
    }
    res.json(updatedVenue);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Public: get sub-pitches for a venue (for /api/venues/:id/sub-pitches)
const getSubPitchesByVenue = async (req, res) => {
  try {
    const { id } = req.params;
    const subPitches = await SubPitch.find({ venueId: id });
    res.json(subPitches);
  } catch (err) {
    console.error("❌ getSubPitchesByVenue error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  listVenues,
  getVenue,
  getMyVenues,
  createVenue,
  updateVenue,
  updateVenueStatus,
  getSubPitchesByVenue,
};
