const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(uri, {
      // options can be added here if needed
    });
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed: ", error);
    process.exit(1);
  }
};

module.exports = connectDB;
